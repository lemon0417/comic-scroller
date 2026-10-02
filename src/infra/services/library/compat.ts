import {
  createByteStream,
  decodeUtf8,
  encodeUtf8,
  readStreamToArrayBuffer,
} from "./byteStreams";
import {
  openLibraryDb,
  requestToPromise,
  transactionDone,
} from "./db";
import type { LibraryDumpV2 } from "./schema";
import {
  createEmptyLibrarySnapshot,
  getExtensionVersion,
  LIBRARY_DB_VERSION,
  LIBRARY_META_KEY,
  LIBRARY_SCHEMA_VERSION,
  META_STORE,
} from "./schema";
import {
  ensureLibraryReady,
  getSubscriptionCheckedAtByKey,
  isLibraryDumpV1,
  isLibraryDumpV2,
  migrateCompactDump,
  migrateDump,
  migrateLibrary,
  persistSnapshot,
  readRowsFromDb,
  rowsToSnapshot,
  snapshotToCompactDumpRows,
} from "./shared";

async function loadLibrary() {
  await ensureLibraryReady();
  const rows = await readRowsFromDb();
  return {
    snapshot: rowsToSnapshot(rows),
    subscriptionCheckedAtByKey: getSubscriptionCheckedAtByKey(
      rows.subscriptions,
    ),
  };
}

function hasGzipMagic(bytes: Uint8Array) {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function toUint8Array(raw: unknown) {
  if (ArrayBuffer.isView(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  }
  const tag = Object.prototype.toString.call(raw);
  if (tag === "[object ArrayBuffer]" || tag === "[object SharedArrayBuffer]") {
    return new Uint8Array(raw as ArrayBufferLike);
  }
  return null;
}

async function decodeJsonText(bytes: Uint8Array) {
  return JSON.parse(decodeUtf8(bytes).replace(/^\uFEFF/, ""));
}

async function gzipJson(text: string) {
  if (typeof CompressionStream !== "function") {
    return {
      blob: new Blob([text], { type: "application/json" }),
      filename: "comic-scroller-library.json",
    };
  }

  const compressed = await readStreamToArrayBuffer(
    createByteStream(encodeUtf8(text)).pipeThrough(
      new CompressionStream("gzip"),
    ),
  );

  return {
    blob: new Blob([compressed], { type: "application/gzip" }),
    filename: "comic-scroller-library.json.gz",
  };
}

async function decodeImportPayload(raw: unknown) {
  if (typeof raw === "string") {
    return JSON.parse(raw);
  }

  if (raw instanceof Blob) {
    return decodeImportPayload(await raw.arrayBuffer());
  }

  const bytes = toUint8Array(raw);
  if (!bytes) {
    return raw;
  }

  if (hasGzipMagic(bytes)) {
    if (typeof DecompressionStream !== "function") {
      throw new Error("Gzip import is not supported in this environment.");
    }

    const decompressed = await readStreamToArrayBuffer(
      createByteStream(Uint8Array.from(bytes)).pipeThrough(
        new DecompressionStream("gzip"),
      ),
    );
    return decodeJsonText(new Uint8Array(decompressed));
  }

  return decodeJsonText(bytes);
}

export async function resetLibrary() {
  await ensureLibraryReady();
  const initial = createEmptyLibrarySnapshot();
  return persistSnapshot(initial, {
    cleanupLegacy: true,
    emitSignal: true,
    signalSource: "resetLibrary",
    scopes: ["series", "chapters", "subscriptions", "history", "updates"],
  });
}

export async function exportLibraryDump(): Promise<LibraryDumpV2> {
  const { snapshot, subscriptionCheckedAtByKey } = await loadLibrary();
  return {
    format: "comic-scroller-db-dump",
    formatVersion: 2,
    exportedAt: Date.now(),
    dbSchemaVersion: LIBRARY_DB_VERSION,
    data: snapshotToCompactDumpRows(
      snapshot,
      subscriptionCheckedAtByKey,
    ),
  };
}

export async function exportLibraryArchive() {
  const dump = await exportLibraryDump();
  return gzipJson(JSON.stringify(dump));
}

export async function importLibraryDump(raw: unknown) {
  const parsed = await decodeImportPayload(raw);
  const snapshot = isLibraryDumpV2(parsed)
    ? migrateCompactDump(parsed)
    : isLibraryDumpV1(parsed)
      ? migrateDump(parsed)
      : migrateLibrary(parsed);
  return persistSnapshot(snapshot, {
    cleanupLegacy: true,
    emitSignal: true,
    signalSource: "importLibrary",
    scopes: ["series", "chapters", "subscriptions", "history", "updates"],
    seriesKeys: Object.keys(snapshot.seriesByKey || {}),
    subscriptionCheckedAtByKey:
      isLibraryDumpV2(parsed) || isLibraryDumpV1(parsed)
        ? getSubscriptionCheckedAtByKey(parsed.data.subscriptions || [])
        : {},
  });
}

export async function setLibraryVersion(version: string) {
  await ensureLibraryReady();
  const db = await openLibraryDb();
  const transaction = db.transaction([META_STORE], "readwrite");
  const done = transactionDone(transaction);
  const metaStore = transaction.objectStore(META_STORE);
  const existing = (await requestToPromise<{
    key: string;
    value: {
      initialized?: boolean;
      version?: string;
      schemaVersion?: number;
      dbSchemaVersion?: number;
      updatedAt?: number;
    };
  } | undefined>(metaStore.get(LIBRARY_META_KEY))) || {
    key: LIBRARY_META_KEY,
    value: {
      initialized: true,
      version: getExtensionVersion(),
      schemaVersion: LIBRARY_SCHEMA_VERSION,
      dbSchemaVersion: LIBRARY_DB_VERSION,
      updatedAt: Date.now(),
    },
  };
  await requestToPromise(
    metaStore.put({
      key: LIBRARY_META_KEY,
      value: {
        ...existing.value,
        initialized: true,
        version,
        updatedAt: Date.now(),
      },
    }),
  );
  await done;
}
