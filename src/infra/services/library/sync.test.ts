import { Buffer } from "buffer";
import {
  CompressionStream,
  DecompressionStream,
  ReadableStream,
} from "stream/web";
import { TextDecoder, TextEncoder } from "util";

import {
  getLibrarySyncStatus,
  LIBRARY_SYNC_MAX_STORAGE_BYTES,
  LIBRARY_SYNC_STATE_KEY,
  pushLibrarySyncIfEnabled,
  setLibrarySyncEnabled,
  syncLibraryNow,
} from "./sync";
import {
  decodeLibrarySyncJson,
  encodeLibrarySyncJson,
  LIBRARY_SYNC_MAX_RAW_BYTES,
} from "./syncCodec";
import {
  createEmptyLibrarySyncState,
  type LibrarySyncStateV1,
  syncIndexedRowsToState,
  syncStateToIndexedRows,
  syncStateToWireRows,
} from "./syncModel";
import { applyLibrarySyncState, readLibrarySyncState } from "./syncPersistence";
import { createLargeSyncFixture } from "./syncTestFixtures";

Object.assign(globalThis, {
  CompressionStream,
  DecompressionStream,
  ReadableStream,
  TextEncoder,
  TextDecoder,
});

jest.mock("./syncPersistence", () => ({
  applyLibrarySyncState: jest.fn(),
  readLibrarySyncState: jest.fn(),
}));

const readLocal = jest.mocked(readLibrarySyncState);
const applyLocal = jest.mocked(applyLibrarySyncState);
const manifestKey = "librarySyncManifest";
const chunkPrefix = "librarySyncChunk:";
let localItems: Record<string, unknown>;
let remoteItems: Record<string, unknown>;
let localSetError: string;
let localGetError: string;
let syncSetError: string;
let syncRemoveError: string;
let runtime: { lastError?: { message: string } };
let library: LibrarySyncStateV1;

function bytes(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function createLibrary(): LibrarySyncStateV1 {
  return {
    ...createEmptyLibrarySyncState(),
    seriesByKey: {
      "dm5:m1": {
        site: "dm5",
        comicsID: "m1",
        title: "Demo",
        cover: "",
        url: "https://www.dm5.com/m1/",
        latestChapterID: "c3",
        lastReadChapterID: "c2",
        readChapterIDs: ["c1", "c2"],
        chapterSummaries: {
          c1: { title: "One", href: "https://www.dm5.com/c1/" },
          c2: { title: "Two", href: "https://www.dm5.com/c2/" },
          c3: { title: "Three", href: "https://www.dm5.com/c3/" },
        },
      },
    },
    subscriptions: ["dm5:m1"],
    history: ["dm5:m1"],
    updates: [{ seriesKey: "dm5:m1", chapterID: "c3" }],
  };
}

function withStorageError(error: string, callback: () => void) {
  if (error) runtime.lastError = { message: error };
  try {
    callback();
  } finally {
    delete runtime.lastError;
  }
}

function createStorageArea(kind: "local" | "sync") {
  const items = () => (kind === "local" ? localItems : remoteItems);
  return {
    get: jest.fn(
      (
        keys: string | string[] | undefined,
        callback: (values: Record<string, unknown>) => void,
      ) => {
        const selected =
          keys == null
            ? { ...items() }
            : Object.fromEntries(
                (typeof keys === "string" ? [keys] : keys).map((key) => [
                  key,
                  items()[key],
                ]),
              );
        withStorageError(kind === "local" ? localGetError : "", () =>
          callback(selected),
        );
      },
    ),
    set: jest.fn((values: Record<string, unknown>, callback: () => void) => {
      const error = kind === "local" ? localSetError : syncSetError;
      if (!error) Object.assign(items(), values);
      withStorageError(error, callback);
    }),
    remove: jest.fn((keys: string[], callback: () => void) => {
      const error = kind === "sync" ? syncRemoveError : "";
      if (!error)
        keys.forEach((key) => {
          delete items()[key];
        });
      withStorageError(error, callback);
    }),
  };
}

function seedRemote(state: LibrarySyncStateV1, chunkCount = 1) {
  const payloadText = JSON.stringify({
    format: "comic-scroller-library-sync",
    formatVersion: 1,
    updatedAt: 3,
    deviceId: "remote-device",
    data: syncStateToWireRows(state),
  });
  remoteItems[manifestKey] = {
    format: "comic-scroller-library-sync",
    formatVersion: 1,
    updatedAt: 3,
    deviceId: "remote-device",
    chunkCount,
    payloadBytes: bytes(payloadText) + chunkCount - 1,
  };
  remoteItems[`${chunkPrefix}0`] = payloadText;
  for (let index = 1; index < chunkCount; index += 1)
    remoteItems[`${chunkPrefix}${index}`] = " ";
}

async function readRemoteWire() {
  const manifest = remoteItems[manifestKey] as {
    chunkCount: number;
    formatVersion: number;
    payloadBytes: number;
  };
  const text = Array.from(
    { length: manifest.chunkCount },
    (_, index) => remoteItems[`${chunkPrefix}${index}`],
  ).join("");
  return manifest.formatVersion === 1
    ? (JSON.parse(text).data as ReturnType<typeof syncStateToWireRows>)
    : syncStateToWireRows(
        syncIndexedRowsToState(
          await decodeLibrarySyncJson(text, manifest.payloadBytes),
        ),
      );
}

beforeEach(() => {
  jest.resetAllMocks();
  localItems = {
    [LIBRARY_SYNC_STATE_KEY]: {
      enabled: true,
      deviceId: "local-device",
      lastSyncedAt: 1,
      payloadBytes: 100,
    },
  };
  remoteItems = {};
  localSetError = localGetError = syncSetError = syncRemoveError = "";
  runtime = {};
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime,
    storage: {
      local: createStorageArea("local"),
      sync: createStorageArea("sync"),
    },
  };
  library = createLibrary();
  readLocal.mockImplementation(async () => ({
    state: library,
    subscriptionCheckedAtByKey: { "dm5:m1": 111 },
  }));
  applyLocal.mockResolvedValue(undefined);
});

it("reduces a roughly 1.9 MB read history to a bounded checkpoint payload", async () => {
  const series = library.seriesByKey["dm5:m1"];
  for (let index = 0; index < 6000; index += 1) {
    const chapterID = `old-${index}`;
    series.readChapterIDs.push(chapterID);
    series.chapterSummaries[chapterID] = {
      title: "x".repeat(260),
      href: `https://www.dm5.com/${chapterID}/`,
    };
  }
  expect(bytes(JSON.stringify(syncStateToWireRows(library)))).toBeGreaterThan(
    1_900_000,
  );
  const status = await syncLibraryNow();
  expect(status.lastError).toBe("");
  expect(status.storageBytes).toBeLessThan(LIBRARY_SYNC_MAX_STORAGE_BYTES);
  expect(await readRemoteWire()).toMatchObject({
    series: [
      { read: ["c2"], chapters: [{ chapterID: "c3" }, { chapterID: "c2" }] },
    ],
    subscriptions: [{ seriesKey: "dm5:m1" }],
    history: ["dm5:m1"],
    updates: library.updates,
  });
  expect(series.readChapterIDs).toHaveLength(6002);
});

it("compacts legacy remote data before merging and applying it", async () => {
  const remote = createLibrary();
  remote.seriesByKey["dm5:m1"].lastReadChapterID = "c3";
  remote.seriesByKey["dm5:m1"].readChapterIDs = ["c1", "c2", "c3"];
  seedRemote(remote, 4);
  const status = await syncLibraryNow();
  expect(status.lastError).toBe("");
  expect(applyLocal).toHaveBeenCalledWith(
    expect.objectContaining({
      seriesByKey: {
        "dm5:m1": expect.objectContaining({
          readChapterIDs: ["c3"],
          chapterSummaries: { c3: expect.any(Object) },
        }),
      },
    }),
    { "dm5:m1": 111 },
  );
  expect((await readRemoteWire()).series[0].read).toEqual(["c3"]);
  expect(
    Object.keys(remoteItems).filter((key) => key.startsWith(chunkPrefix)),
  ).toEqual([`${chunkPrefix}0`]);
});

it("chunks Chinese, emoji and escaped characters by serialized storage bytes", async () => {
  const title = Array.from(
    { length: 3500 },
    (_, index) => '中文😀"\\\n' + index,
  ).join("");
  library.seriesByKey["dm5:m1"].title = title;
  const status = await pushLibrarySyncIfEnabled();
  expect(status.lastError).toBe("");
  const chunks = Object.entries(remoteItems).filter(([key]) =>
    key.startsWith(chunkPrefix),
  );
  expect(chunks.length).toBeGreaterThan(1);
  for (const [key, chunk] of chunks)
    expect(bytes(key) + bytes(JSON.stringify(chunk))).toBeLessThanOrEqual(6000);
  expect((await readRemoteWire()).series[0].title).toBe(title);
});

it.each([syncLibraryNow, pushLibrarySyncIfEnabled])(
  "preserves Chrome write errors and attempted bytes (%#)",
  async (sync) => {
    syncSetError = "QUOTA_BYTES_PER_ITEM quota exceeded";
    const status = await sync();
    expect(status.lastError).toBe(syncSetError);
    expect(status.pendingPayloadBytes).toBeGreaterThan(0);
    expect(status.payloadBytes).toBe(100);
    expect(status.lastSyncedAt).toBe(1);
    expect(await getLibrarySyncStatus()).toMatchObject({
      lastError: syncSetError,
      pendingPayloadBytes: status.pendingPayloadBytes,
    });
  },
);

it("returns the original write error even when local error persistence also fails", async () => {
  syncSetError = "Original Chrome quota error";
  localSetError = "Local storage unavailable";
  const status = await syncLibraryNow();
  expect(status).toMatchObject({
    enabled: true,
    lastError: syncSetError,
    lastSyncedAt: 1,
  });
  expect(status.pendingPayloadBytes).toBeGreaterThan(0);
});

it("reports initialization errors instead of rejecting the sync request", async () => {
  localGetError = "Local storage read failed";
  localSetError = "Local storage write failed";
  await expect(syncLibraryNow()).resolves.toMatchObject({
    lastError: localGetError,
  });
  await expect(pushLibrarySyncIfEnabled()).resolves.toMatchObject({
    lastError: localGetError,
  });
  await expect(setLibrarySyncEnabled(true)).resolves.toMatchObject({
    lastError: localGetError,
  });
});

it("accepts large raw payloads that fit after compression and clears failed-attempt sizes", async () => {
  library.seriesByKey["dm5:m1"].title = "x".repeat(100_000);
  syncSetError = "Temporary write failure";
  const status = await syncLibraryNow();
  expect(status.lastError).toBe(syncSetError);
  expect(status.pendingPayloadBytes).toBeGreaterThan(
    LIBRARY_SYNC_MAX_STORAGE_BYTES,
  );
  expect(status.pendingStorageBytes).toBeLessThan(
    LIBRARY_SYNC_MAX_STORAGE_BYTES,
  );
  expect(status.payloadBytes).toBe(100);
  syncSetError = "";
  const success = await syncLibraryNow();
  expect(success.lastError).toBe("");
  expect(success.payloadBytes).toBeGreaterThan(LIBRARY_SYNC_MAX_STORAGE_BYTES);
  expect(success.storageBytes).toBeLessThan(LIBRARY_SYNC_MAX_STORAGE_BYTES);
  expect(success.pendingPayloadBytes).toBeUndefined();
  expect(success.pendingStorageBytes).toBeUndefined();
});

it("rejects oversized compressed data without trimming subscriptions or touching remote data", async () => {
  library = createLargeSyncFixture(true);
  const status = await syncLibraryNow();
  expect(status.lastError).toContain("超過 Chrome Sync 安全配額 92160 bytes");
  expect(status.pendingStorageBytes).toBeGreaterThan(
    LIBRARY_SYNC_MAX_STORAGE_BYTES,
  );
  expect(library.subscriptions).toHaveLength(395);
  expect(library.updates).toHaveLength(4200);
  expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  expect(remoteItems).toEqual({});
});

it("writes a v2 library with 395 subscriptions and 4200 updates below 90 KiB", async () => {
  library = createLargeSyncFixture();
  const status = await syncLibraryNow();
  expect(status.lastError).toBe("");
  expect(status.storageBytes).toBeLessThan(LIBRARY_SYNC_MAX_STORAGE_BYTES);
  expect(status.payloadBytes).toBeGreaterThan(LIBRARY_SYNC_MAX_STORAGE_BYTES);
  expect(remoteItems[manifestKey]).toMatchObject({
    formatVersion: 2,
    encoding: "indexed-json-gzip-base64",
  });
  const restored = await readRemoteWire();
  expect(restored.subscriptions).toHaveLength(395);
  expect(restored.updates).toEqual(library.updates);
  expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1);
});

it("accounts for unrelated items and serialized overhead before writing", async () => {
  remoteItems = Object.fromEntries(
    Array.from({ length: 20 }, (_, index) => [
      `other-${index}`,
      "x".repeat(5100),
    ]),
  );
  library.seriesByKey["dm5:m1"].title = "x".repeat(13_000);
  const previousItems = { ...remoteItems };
  const status = await pushLibrarySyncIfEnabled();
  expect(status.pendingPayloadBytes).toBeLessThan(
    LIBRARY_SYNC_MAX_STORAGE_BYTES,
  );
  expect(status.lastError).toContain("Chrome Sync 總配額 102400 bytes");
  expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  expect(remoteItems).toEqual(previousItems);
});

it("captures stale chunk removal failures without advancing the successful timestamp", async () => {
  seedRemote(createLibrary(), 4);
  syncRemoveError = "Chrome removal failed";
  const status = await syncLibraryNow();
  expect(status.lastError).toBe(syncRemoveError);
  expect(status.pendingPayloadBytes).toBeGreaterThan(0);
  expect(status.lastSyncedAt).toBe(1);
});

it.each([syncLibraryNow, pushLibrarySyncIfEnabled])(
  "does not overwrite unknown or damaged remote data (%#)",
  async (sync) => {
    seedRemote(createLibrary());
    const manifest = remoteItems[manifestKey] as Record<string, unknown>;
    manifest.formatVersion = 3;
    const previous = { ...remoteItems };
    expect((await sync()).lastError).toContain("不受支援");
    expect(remoteItems).toEqual(previous);
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(applyLocal).not.toHaveBeenCalled();
  },
);

it.each([syncLibraryNow, pushLibrarySyncIfEnabled])(
  "rejects malformed legacy chapter summaries (%#)",
  async (sync) => {
    seedRemote(createLibrary());
    const payload = JSON.parse(remoteItems[`${chunkPrefix}0`] as string);
    payload.data.series[0].chapters[0].title = 123;
    const text = JSON.stringify(payload);
    remoteItems[`${chunkPrefix}0`] = text;
    (remoteItems[manifestKey] as Record<string, unknown>).payloadBytes =
      bytes(text);
    const previous = { ...remoteItems };
    expect((await sync()).lastError).toContain("v1");
    expect(remoteItems).toEqual(previous);
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(applyLocal).not.toHaveBeenCalled();
  },
);

it("requests a Chrome upgrade when compression is unavailable without a remote write", async () => {
  const original = globalThis.CompressionStream;
  try {
    Object.assign(globalThis, { CompressionStream: undefined });
    expect((await syncLibraryNow()).lastError).toContain("更新 Chrome");
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  } finally {
    Object.assign(globalThis, { CompressionStream: original });
  }
});

describe.each([syncLibraryNow, pushLibrarySyncIfEnabled])(
  "invalid remote protection (%#)",
  (sync) => {
    it.each([
      "missing chunk",
      "encoding",
      "encoded size",
      "raw size",
      "gzip",
      "indices",
      "manifest",
    ])("refuses %s before applying or writing", async (damage) => {
      const json = JSON.stringify(syncStateToIndexedRows(library));
      let encoded = await encodeLibrarySyncJson(json);
      const manifest: Record<string, unknown> = {
        format: "comic-scroller-library-sync",
        formatVersion: 2,
        encoding: "indexed-json-gzip-base64",
        updatedAt: 3,
        deviceId: "remote-device",
        chunkCount: 1,
        payloadBytes: bytes(json),
        encodedBytes: encoded.length,
      };
      if (damage === "encoding") manifest.encoding = "protobuf";
      if (damage === "encoded size") manifest.encodedBytes = encoded.length + 1;
      if (damage === "raw size") manifest.payloadBytes = bytes(json) + 1;
      if (damage === "gzip") encoded = btoa("not gzip");
      if (damage === "indices") {
        const invalid = "[[],[1],[],[]]";
        encoded = await encodeLibrarySyncJson(invalid);
        manifest.payloadBytes = bytes(invalid);
      }
      if (damage === "gzip" || damage === "indices")
        manifest.encodedBytes = encoded.length;
      remoteItems = {
        [manifestKey]: damage === "manifest" ? null : manifest,
        ...(damage === "missing chunk" ? {} : { [`${chunkPrefix}0`]: encoded }),
      };
      const previous = JSON.parse(JSON.stringify(remoteItems));
      const status = await sync();
      expect(status.lastError).toBeTruthy();
      expect(status.lastSyncedAt).toBe(1);
      expect(remoteItems).toEqual(previous);
      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
      expect(applyLocal).not.toHaveBeenCalled();
    });
  },
);

it("includes stale tails in preflight and retains them if the replacement cannot fit", async () => {
  seedRemote(createLibrary());
  for (let index = 1; index < 18; index += 1)
    remoteItems[`${chunkPrefix}${index}`] = "x".repeat(5980);
  library = createLargeSyncFixture();
  const previous = { ...remoteItems };
  const status = await pushLibrarySyncIfEnabled();
  expect(status.lastError).toContain("Chrome Sync 總配額");
  expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
  expect(remoteItems).toEqual(previous);
});

it("reads v2 on a new device and applies the whole ordered library", async () => {
  library = createLargeSyncFixture();
  expect((await syncLibraryNow()).lastError).toBe("");
  const remote = JSON.parse(JSON.stringify(remoteItems));
  library = createEmptyLibrarySyncState();
  readLocal.mockResolvedValueOnce({
    state: library,
    subscriptionCheckedAtByKey: {},
  });
  localItems = {
    [LIBRARY_SYNC_STATE_KEY]: { enabled: true, deviceId: "new-device" },
  };
  remoteItems = remote;
  expect((await syncLibraryNow()).lastError).toBe("");
  expect(applyLocal).toHaveBeenCalledWith(
    expect.objectContaining({
      subscriptions: expect.any(Array),
      updates: expect.any(Array),
    }),
    {},
  );
  const applied = applyLocal.mock.calls[0][0];
  expect(applied.subscriptions).toHaveLength(395);
  expect(applied.updates).toHaveLength(4200);
});

it("refuses raw inputs over the processing limit without a remote write", async () => {
  library.seriesByKey["dm5:m1"].title = "x".repeat(
    LIBRARY_SYNC_MAX_RAW_BYTES + 1,
  );
  const status = await syncLibraryNow();
  expect(status.lastError).toContain("處理上限");
  expect(status.pendingPayloadBytes).toBeGreaterThan(
    LIBRARY_SYNC_MAX_RAW_BYTES,
  );
  expect(status.pendingStorageBytes).toBeUndefined();
  expect(chrome.storage.sync.set).not.toHaveBeenCalled();
});
