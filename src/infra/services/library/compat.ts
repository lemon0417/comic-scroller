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
  persistSnapshot,
  readRowsFromDb,
  requestToPromise,
  rowsToSnapshot,
  snapshotToRows,
  transactionDone,
  openLibraryDb,
} from "./shared";

async function loadLibrary() {
  await ensureLibraryReady();
  return rowsToSnapshot(await readRowsFromDb());
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

export async function importLibraryDump(raw: any) {
  const snapshot = isLibraryDumpV1(raw) ? migrateDump(raw) : migrateLibrary(raw);
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
  const existing = (await requestToPromise<any>(metaStore.get(LIBRARY_META_KEY))) || {
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
