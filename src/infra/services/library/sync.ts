import type { LibrarySyncStatus } from "@domain/library";
import { createEmptyLibrarySyncStatus } from "@domain/library";

import {
  decodeLibrarySyncJson,
  encodeLibrarySyncJson,
  getUtf8ByteLength,
  LIBRARY_SYNC_ENCODING,
  LIBRARY_SYNC_MAX_RAW_BYTES,
} from "./syncCodec";
import type { LibrarySyncStateV1, LibrarySyncWireRowsV1 } from "./syncModel";
import {
  compactLibrarySyncState,
  mergeLibrarySyncStates,
  syncIndexedRowsToState,
  syncStateToIndexedRows,
  syncWireRowsToState,
} from "./syncModel";
import { applyLibrarySyncState, readLibrarySyncState } from "./syncPersistence";

export const LIBRARY_SYNC_STATE_KEY = "librarySyncState";
export const LIBRARY_SYNC_MAX_STORAGE_BYTES = 90 * 1024;

const LIBRARY_SYNC_MANIFEST_KEY = "librarySyncManifest";
const LIBRARY_SYNC_CHUNK_PREFIX = "librarySyncChunk:";
const LIBRARY_SYNC_PAYLOAD_FORMAT = "comic-scroller-library-sync";
const LIBRARY_SYNC_CHUNK_SIZE = 6000;
const LIBRARY_SYNC_STORAGE_QUOTA_BYTES = 100 * 1024;

type StoredLibrarySyncState = {
  enabled?: boolean;
  deviceId?: string;
  lastSyncedAt?: number;
  lastRemoteUpdatedAt?: number;
  lastError?: string;
  payloadBytes?: number;
  pendingPayloadBytes?: number;
  storageBytes?: number;
  pendingStorageBytes?: number;
};

class LibrarySyncWriteError extends Error {
  constructor(
    message: string,
    readonly payloadBytes: number,
    readonly storageBytes?: number,
  ) {
    super(message);
    Object.setPrototypeOf(this, LibrarySyncWriteError.prototype);
  }
}

type LibrarySyncManifestBase = {
  format: typeof LIBRARY_SYNC_PAYLOAD_FORMAT;
  updatedAt: number;
  deviceId: string;
  chunkCount: number;
  payloadBytes: number;
};

type LibrarySyncManifest = LibrarySyncManifestBase &
  (
    | { formatVersion: 1 }
    | {
        formatVersion: 2;
        encoding: typeof LIBRARY_SYNC_ENCODING;
        encodedBytes: number;
      }
  );

type LibrarySyncPayloadV1 = {
  format: typeof LIBRARY_SYNC_PAYLOAD_FORMAT;
  formatVersion: 1;
  updatedAt: number;
  deviceId: string;
  data: LibrarySyncWireRowsV1;
};

type RemoteLibrarySyncPayload = {
  manifest: LibrarySyncManifest;
  state: LibrarySyncStateV1;
};

function toRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function toPositiveNumber(input: unknown) {
  const value = Number(input || 0);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error || "同步失敗");
}

function getStorageArea(kind: "local" | "sync") {
  if (typeof chrome === "undefined") {
    return null;
  }
  return chrome.storage?.[kind] || null;
}

function getChromeStorageError() {
  if (typeof chrome === "undefined") {
    return "";
  }
  const error = (
    chrome.runtime as typeof chrome.runtime & { lastError?: unknown }
  )?.lastError;
  if (!error) {
    return "";
  }
  if (typeof error === "string") {
    return error;
  }
  const message = toRecord(error).message;
  return typeof message === "string" ? message : String(error);
}

function isStorageAvailable() {
  return Boolean(getStorageArea("local") && getStorageArea("sync"));
}

function storageGet(
  area: chrome.storage.StorageArea | null,
  keys: string | string[] | null,
): Promise<Record<string, unknown>> {
  if (!area) {
    return Promise.reject(new Error("Chrome storage is not available."));
  }
  return new Promise((resolve, reject) => {
    area.get(keys ?? undefined, (items) => {
      const error = getChromeStorageError();
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve((items || {}) as Record<string, unknown>);
    });
  });
}

function storageSet(
  area: chrome.storage.StorageArea | null,
  items: Record<string, unknown>,
): Promise<void> {
  if (!area) {
    return Promise.reject(new Error("Chrome storage is not available."));
  }
  return new Promise((resolve, reject) => {
    area.set(items, () => {
      const error = getChromeStorageError();
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve();
    });
  });
}

function storageRemove(
  area: chrome.storage.StorageArea | null,
  keys: string[],
): Promise<void> {
  if (!area || keys.length === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    area.remove(keys, () => {
      const error = getChromeStorageError();
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve();
    });
  });
}

function normalizeStoredSyncState(input: unknown): StoredLibrarySyncState {
  const source = toRecord(input);
  return {
    enabled: Boolean(source.enabled),
    deviceId: typeof source.deviceId === "string" ? source.deviceId : "",
    lastSyncedAt: toPositiveNumber(source.lastSyncedAt),
    lastRemoteUpdatedAt: toPositiveNumber(source.lastRemoteUpdatedAt),
    lastError: typeof source.lastError === "string" ? source.lastError : "",
    payloadBytes: toPositiveNumber(source.payloadBytes),
    pendingPayloadBytes: toPositiveNumber(source.pendingPayloadBytes),
    storageBytes: toPositiveNumber(source.storageBytes),
    pendingStorageBytes: toPositiveNumber(source.pendingStorageBytes),
  };
}

function compactStoredSyncState(state: StoredLibrarySyncState) {
  const result: StoredLibrarySyncState = {
    enabled: Boolean(state.enabled),
  };
  if (state.deviceId) result.deviceId = state.deviceId;
  if (state.lastSyncedAt) result.lastSyncedAt = state.lastSyncedAt;
  if (state.lastRemoteUpdatedAt) {
    result.lastRemoteUpdatedAt = state.lastRemoteUpdatedAt;
  }
  if (state.lastError) result.lastError = state.lastError;
  if (state.payloadBytes) result.payloadBytes = state.payloadBytes;
  if (state.pendingPayloadBytes)
    result.pendingPayloadBytes = state.pendingPayloadBytes;
  if (state.storageBytes) result.storageBytes = state.storageBytes;
  if (state.pendingStorageBytes)
    result.pendingStorageBytes = state.pendingStorageBytes;
  return result;
}

async function readLocalSyncState() {
  const items = await storageGet(getStorageArea("local"), [
    LIBRARY_SYNC_STATE_KEY,
  ]);
  return normalizeStoredSyncState(items[LIBRARY_SYNC_STATE_KEY]);
}

async function writeLocalSyncState(state: StoredLibrarySyncState) {
  await storageSet(getStorageArea("local"), {
    [LIBRARY_SYNC_STATE_KEY]: compactStoredSyncState(state),
  });
}

function createDeviceId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureLocalSyncState() {
  const state = await readLocalSyncState();
  if (state.deviceId) {
    return state;
  }
  const next = {
    ...state,
    deviceId: createDeviceId(),
  };
  await writeLocalSyncState(next);
  return next;
}

function chunkString(input: string) {
  const chunks: string[] = [];
  let chunk = "";
  let bytes = getUtf8ByteLength(getChunkKey(0)) + 2;
  // Iterate code points so a surrogate pair never straddles two storage items.
  for (const character of Array.from(input)) {
    const characterBytes = getUtf8ByteLength(JSON.stringify(character)) - 2;
    if (bytes + characterBytes > LIBRARY_SYNC_CHUNK_SIZE) {
      chunks.push(chunk);
      chunk = "";
      bytes = getUtf8ByteLength(getChunkKey(chunks.length)) + 2;
    }
    chunk += character;
    bytes += characterBytes;
  }
  chunks.push(chunk);
  return chunks;
}

function getStorageByteLength(items: Record<string, unknown>) {
  return Object.entries(items).reduce(
    (total, [key, value]) =>
      total + getUtf8ByteLength(key) + getUtf8ByteLength(JSON.stringify(value)),
    0,
  );
}

function getChunkKey(index: number) {
  return `${LIBRARY_SYNC_CHUNK_PREFIX}${index}`;
}

function normalizeLibrarySyncManifest(
  input: unknown,
): LibrarySyncManifest | null {
  if (input === undefined) return null;
  const source = toRecord(input);
  if (
    source.format !== LIBRARY_SYNC_PAYLOAD_FORMAT ||
    ![1, 2].includes(Number(source.formatVersion))
  ) {
    throw new Error("遠端同步格式不受支援，請更新所有裝置的 Comic Scroller。");
  }
  if (
    typeof source.formatVersion !== "number" ||
    typeof source.deviceId !== "string" ||
    !source.deviceId ||
    typeof source.updatedAt !== "number" ||
    !Number.isSafeInteger(source.updatedAt) ||
    source.updatedAt < 0 ||
    typeof source.chunkCount !== "number" ||
    !Number.isSafeInteger(source.chunkCount) ||
    source.chunkCount < 1 ||
    source.chunkCount > 512 ||
    typeof source.payloadBytes !== "number" ||
    !Number.isSafeInteger(source.payloadBytes) ||
    source.payloadBytes < 1 ||
    source.payloadBytes > LIBRARY_SYNC_MAX_RAW_BYTES
  ) {
    throw new Error("遠端同步 manifest 不完整或資料大小超過處理上限。");
  }
  const base: LibrarySyncManifestBase = {
    format: LIBRARY_SYNC_PAYLOAD_FORMAT,
    updatedAt: source.updatedAt,
    deviceId: source.deviceId,
    chunkCount: source.chunkCount,
    payloadBytes: source.payloadBytes,
  };
  if (source.formatVersion === 1) return { ...base, formatVersion: 1 };
  if (source.encoding !== LIBRARY_SYNC_ENCODING) {
    throw new Error("遠端同步編碼不受支援，請更新所有裝置的 Comic Scroller。");
  }
  if (
    typeof source.encodedBytes !== "number" ||
    !Number.isSafeInteger(source.encodedBytes) ||
    source.encodedBytes < 1 ||
    source.encodedBytes > LIBRARY_SYNC_STORAGE_QUOTA_BYTES
  ) {
    throw new Error("遠端同步編碼大小不正確或超過儲存上限。");
  }
  return {
    ...base,
    formatVersion: 2,
    encoding: LIBRARY_SYNC_ENCODING,
    encodedBytes: source.encodedBytes,
  };
}

function readRemoteSummary(items: Record<string, unknown>) {
  const manifest = normalizeLibrarySyncManifest(
    items[LIBRARY_SYNC_MANIFEST_KEY],
  );
  if (!manifest) return null;
  const chunkKeys = Array.from({ length: manifest.chunkCount }, (_, index) =>
    getChunkKey(index),
  );
  const chunks = chunkKeys.map((key) => {
    if (typeof items[key] !== "string" || !items[key]) {
      throw new Error("遠端同步分片不完整，請稍後再試。");
    }
    return items[key] as string;
  });
  const text = chunks.join("");
  const expectedBytes =
    manifest.formatVersion === 2
      ? manifest.encodedBytes
      : manifest.payloadBytes;
  if (getUtf8ByteLength(text) !== expectedBytes) {
    throw new Error("遠端同步分片大小與 manifest 不符，請稍後再試。");
  }
  const storedItems = Object.fromEntries(
    [LIBRARY_SYNC_MANIFEST_KEY, ...chunkKeys].map((key) => [key, items[key]]),
  );
  return { manifest, text, storageBytes: getStorageByteLength(storedItems) };
}

function isLibrarySyncPayloadV1(input: unknown): input is LibrarySyncPayloadV1 {
  const source = toRecord(input);
  const data = toRecord(source.data);
  if (
    !(
      source.format === LIBRARY_SYNC_PAYLOAD_FORMAT &&
      source.formatVersion === 1 &&
      typeof source.deviceId === "string" &&
      typeof source.updatedAt === "number" &&
      [data.series, data.subscriptions, data.history, data.updates].every(
        Array.isArray,
      )
    )
  )
    return false;
  return (
    (data.series as unknown[]).every((item) => {
      const series = toRecord(item);
      if (
        ![
          series.site,
          series.comicsID,
          series.title,
          series.cover,
          series.url,
          series.lastRead,
        ].every((value) => typeof value === "string") ||
        !series.comicsID ||
        !Array.isArray(series.chapters)
      )
        return false;
      if (
        series.read !== undefined &&
        (!Array.isArray(series.read) ||
          !series.read.every((id) => typeof id === "string" && id.length > 0))
      )
        return false;
      const chapterIDs = new Set<string>();
      return series.chapters.every((item) => {
        const chapter = toRecord(item);
        if (
          typeof chapter.chapterID !== "string" ||
          !chapter.chapterID ||
          chapterIDs.has(chapter.chapterID) ||
          typeof chapter.title !== "string" ||
          typeof chapter.href !== "string"
        )
          return false;
        chapterIDs.add(chapter.chapterID);
        return true;
      });
    }) &&
    (data.history as unknown[]).every((id) => typeof id === "string") &&
    (data.subscriptions as unknown[]).every(
      (item) => typeof toRecord(item).seriesKey === "string",
    ) &&
    (data.updates as unknown[]).every((item) => {
      const update = toRecord(item);
      return (
        typeof update.seriesKey === "string" &&
        typeof update.chapterID === "string"
      );
    })
  );
}

async function decodeRemoteItems(
  items: Record<string, unknown>,
): Promise<RemoteLibrarySyncPayload | null> {
  const remote = readRemoteSummary(items);
  if (!remote) return null;
  const { manifest, text } = remote;
  if (manifest.formatVersion === 2) {
    return {
      manifest,
      state: syncIndexedRowsToState(
        await decodeLibrarySyncJson(text, manifest.payloadBytes),
      ),
    };
  }
  const parsed: unknown = JSON.parse(text);
  if (
    !isLibrarySyncPayloadV1(parsed) ||
    parsed.deviceId !== manifest.deviceId ||
    parsed.updatedAt !== manifest.updatedAt
  ) {
    throw new Error("遠端同步 v1 資料與 manifest 不符，請稍後再試。");
  }
  const state = syncWireRowsToState(parsed.data);
  if (
    Object.keys(state.seriesByKey).length !== parsed.data.series.length ||
    state.subscriptions.length !== parsed.data.subscriptions.length ||
    state.history.length !== parsed.data.history.length ||
    state.updates.length !== parsed.data.updates.length
  ) {
    throw new Error("遠端同步 v1 資料包含不合法的作品或清單項目。");
  }
  return { manifest, state: compactLibrarySyncState(state) };
}

async function readRemotePayload(): Promise<RemoteLibrarySyncPayload | null> {
  return decodeRemoteItems(await storageGet(getStorageArea("sync"), null));
}

async function writeRemoteState(
  libraryState: LibrarySyncStateV1,
  state: StoredLibrarySyncState,
) {
  const now = Date.now();
  const deviceId = state.deviceId || createDeviceId();
  const json = JSON.stringify(syncStateToIndexedRows(libraryState));
  const payloadBytes = getUtf8ByteLength(json);
  let storageBytes: number | undefined;
  try {
    const previousItems = await storageGet(getStorageArea("sync"), null);
    // Automatic pushes must also refuse unknown or damaged remote payloads.
    await decodeRemoteItems(previousItems);
    const encoded = await encodeLibrarySyncJson(json);
    const chunks = chunkString(encoded);
    const syncItems: Record<string, unknown> = Object.fromEntries(
      chunks.map((chunk, index) => [getChunkKey(index), chunk]),
    );
    syncItems[LIBRARY_SYNC_MANIFEST_KEY] = {
      format: LIBRARY_SYNC_PAYLOAD_FORMAT,
      formatVersion: 2,
      encoding: LIBRARY_SYNC_ENCODING,
      updatedAt: now,
      deviceId,
      chunkCount: chunks.length,
      payloadBytes,
      encodedBytes: encoded.length,
    } satisfies LibrarySyncManifest;
    storageBytes = getStorageByteLength(syncItems);
    if (storageBytes > LIBRARY_SYNC_MAX_STORAGE_BYTES) {
      throw new Error(
        `同步儲存資料 ${storageBytes} bytes 超過 Chrome Sync 安全配額 ${LIBRARY_SYNC_MAX_STORAGE_BYTES} bytes（原始資料 ${payloadBytes} bytes）。`,
      );
    }
    // Include old tails and unrelated keys: stale removal runs after set().
    const totalStorageBytes = getStorageByteLength({
      ...previousItems,
      ...syncItems,
    });
    if (totalStorageBytes > LIBRARY_SYNC_STORAGE_QUOTA_BYTES) {
      throw new Error(
        `同步儲存資料合計 ${totalStorageBytes} bytes 超過 Chrome Sync 總配額 ${LIBRARY_SYNC_STORAGE_QUOTA_BYTES} bytes（本次同步 ${storageBytes} bytes，另含既有資料）。`,
      );
    }
    await storageSet(getStorageArea("sync"), syncItems);
    const activeKeys = new Set(Object.keys(syncItems));
    const staleChunkKeys = Object.keys(previousItems).filter(
      (key) => /^librarySyncChunk:\d+$/.test(key) && !activeKeys.has(key),
    );
    await storageRemove(getStorageArea("sync"), staleChunkKeys);
    await writeLocalSyncState({
      ...state,
      deviceId,
      lastSyncedAt: now,
      lastRemoteUpdatedAt: now,
      lastError: "",
      payloadBytes,
      storageBytes,
      pendingPayloadBytes: undefined,
      pendingStorageBytes: undefined,
    });
    return await getLibrarySyncStatus();
  } catch (error) {
    throw new LibrarySyncWriteError(
      toErrorMessage(error),
      payloadBytes,
      storageBytes,
    );
  }
}

async function recordSyncError(error: unknown, state?: StoredLibrarySyncState) {
  const currentState =
    state ||
    (await readLocalSyncState().catch(() => normalizeStoredSyncState({})));
  const nextState = {
    ...currentState,
    lastError: toErrorMessage(error),
    pendingPayloadBytes:
      error instanceof LibrarySyncWriteError ? error.payloadBytes : undefined,
    pendingStorageBytes:
      error instanceof LibrarySyncWriteError ? error.storageBytes : undefined,
  };
  await writeLocalSyncState(nextState).catch(() => undefined);
  const status = await getLibrarySyncStatus();
  return {
    ...status,
    enabled: Boolean(nextState.enabled),
    lastSyncedAt: nextState.lastSyncedAt,
    lastError: nextState.lastError,
    pendingPayloadBytes: nextState.pendingPayloadBytes,
    pendingStorageBytes: nextState.pendingStorageBytes,
  };
}

export async function getLibrarySyncStatus(): Promise<LibrarySyncStatus> {
  const available = isStorageAvailable();
  const state = await readLocalSyncState().catch(() =>
    normalizeStoredSyncState({}),
  );
  const remote = available
    ? await storageGet(getStorageArea("sync"), null)
        .then(readRemoteSummary)
        .catch(() => null)
    : null;

  return createEmptyLibrarySyncStatus({
    enabled: Boolean(state.enabled),
    available,
    lastSyncedAt: state.lastSyncedAt,
    remoteUpdatedAt: remote?.manifest.updatedAt || state.lastRemoteUpdatedAt,
    lastError: state.lastError,
    payloadBytes: remote?.manifest.payloadBytes || state.payloadBytes,
    storageBytes: remote?.storageBytes || state.storageBytes,
    pendingStorageBytes: state.pendingStorageBytes,
    pendingPayloadBytes: state.pendingPayloadBytes,
    quotaBytes: LIBRARY_SYNC_MAX_STORAGE_BYTES,
  });
}

export async function setLibrarySyncEnabled(enabled: boolean) {
  let state: StoredLibrarySyncState | undefined;
  try {
    state = await ensureLocalSyncState();
    await writeLocalSyncState({
      ...state,
      enabled,
      lastError: "",
      pendingPayloadBytes: undefined,
      pendingStorageBytes: undefined,
    });
    return await getLibrarySyncStatus();
  } catch (error) {
    return recordSyncError(error, state);
  }
}

export async function syncLibraryNow() {
  let state: StoredLibrarySyncState | undefined;
  try {
    state = await ensureLocalSyncState();
    if (!state.enabled) return await getLibrarySyncStatus();
    const local = await readLibrarySyncState();
    const remotePayload = await readRemotePayload();
    const remoteIsNewer = Boolean(
      remotePayload?.manifest.updatedAt &&
        remotePayload.manifest.updatedAt > (state.lastRemoteUpdatedAt || 0),
    );
    const mergedState = compactLibrarySyncState(
      remotePayload
        ? mergeLibrarySyncStates(
            compactLibrarySyncState(local.state),
            remotePayload.state,
            remoteIsNewer ? "remote" : "local",
          )
        : local.state,
    );

    if (remotePayload) {
      await applyLibrarySyncState(
        mergedState,
        local.subscriptionCheckedAtByKey,
      );
    }

    return await writeRemoteState(mergedState, {
      ...state,
      lastRemoteUpdatedAt:
        remotePayload?.manifest.updatedAt || state.lastRemoteUpdatedAt,
    });
  } catch (error) {
    return recordSyncError(error, state);
  }
}

export async function pushLibrarySyncIfEnabled() {
  let state: StoredLibrarySyncState | undefined;
  try {
    state = await readLocalSyncState();
    if (!state.enabled) return await getLibrarySyncStatus();
    const local = await readLibrarySyncState();
    return await writeRemoteState(local.state, {
      ...state,
      deviceId: state.deviceId || createDeviceId(),
    });
  } catch (error) {
    return recordSyncError(error, state);
  }
}
