import type { LibraryDumpV1 } from "./schema";
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
  isLibraryDumpV1,
  migrateDump,
  migrateLibrary,
  openLibraryDb,
  persistSnapshot,
  readRowsFromDb,
  requestToPromise,
  rowsToSnapshot,
  snapshotToRows,
  transactionDone,
} from "./shared";

async function loadLibrary() {
  await ensureLibraryReady();
  return rowsToSnapshot(await readRowsFromDb());
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

function encodeUtf8(text: string) {
  if (typeof TextEncoder === "function") {
    return new TextEncoder().encode(text);
  }
  if (typeof Buffer === "function") {
    return Uint8Array.from(Buffer.from(text, "utf8"));
  }
  throw new Error("UTF-8 encoding is not supported in this environment.");
}

function decodeUtf8(bytes: Uint8Array) {
  if (typeof TextDecoder === "function") {
    return new TextDecoder().decode(bytes);
  }
  if (typeof Buffer === "function") {
    return Buffer.from(bytes).toString("utf8");
  }
  throw new Error("UTF-8 decoding is not supported in this environment.");
}

function createByteStream(bytes: Uint8Array) {
  return new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(Uint8Array.from(bytes));
      controller.close();
    },
  });
}

function bufferSourceToUint8Array(value: BufferSource) {
  if (ArrayBuffer.isView(value)) {
    return Uint8Array.from(
      new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
    );
  }
  return Uint8Array.from(new Uint8Array(value));
}

async function readStreamToArrayBuffer(stream: ReadableStream<BufferSource>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const chunk = bufferSourceToUint8Array(value);
    chunks.push(chunk);
    total += chunk.byteLength;
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return combined.buffer;
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
    scopes: ["series", "subscriptions", "history", "updates"],
  });
}

export async function exportLibraryDump(): Promise<LibraryDumpV1> {
  const snapshot = await loadLibrary();
  return {
    format: "comic-scroller-db-dump",
    formatVersion: 1,
    exportedAt: Date.now(),
    dbSchemaVersion: LIBRARY_DB_VERSION,
    data: snapshotToRows(snapshot),
  };
}

export async function exportLibraryArchive() {
  const dump = await exportLibraryDump();
  return gzipJson(JSON.stringify(dump));
}

export async function importLibraryDump(raw: unknown) {
  const parsed = await decodeImportPayload(raw);
  const snapshot = isLibraryDumpV1(parsed) ? migrateDump(parsed) : migrateLibrary(parsed);
  return persistSnapshot(snapshot, {
    cleanupLegacy: true,
    emitSignal: true,
    signalSource: "importLibrary",
    scopes: ["series", "subscriptions", "history", "updates"],
    seriesKeys: Object.keys(snapshot.seriesByKey || {}),
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
