import type { LibraryDumpV1, LibrarySnapshotV2 } from "./schema";
import {
  createEmptyLibrarySnapshot,
  getExtensionVersion,
  LIBRARY_META_KEY,
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

export async function loadLibrary() {
  await ensureLibraryReady();
  return rowsToSnapshot(await readRowsFromDb());
}

export async function saveLibrary(snapshot: LibrarySnapshotV2) {
  await ensureLibraryReady();
  return persistSnapshot(snapshot, {
    cleanupLegacy: true,
    emitSignal: true,
    signalSource: "saveLibrary",
    scopes: ["series", "subscriptions", "history", "updates"],
    seriesKeys: Object.keys(snapshot.seriesByKey || {}),
  });
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
    dbSchemaVersion: 1,
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

export { migrateLibrary };

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
      schemaVersion: 2,
      dbSchemaVersion: 1,
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
