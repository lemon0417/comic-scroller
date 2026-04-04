type StorageCallback<T> = (_items: T) => void;

type ErrorCallback = (_err?: unknown) => void;

export function storageGet<T = Record<string, unknown>>(
  keys?:
    | string
    | string[]
    | Record<string, unknown>
    | StorageCallback<T>
    | null,
  cb?: StorageCallback<T>,
) {
  if (typeof keys === "function") {
    return chrome.storage.local.get(keys as ChromeStorageCallback);
  }
  return chrome.storage.local.get(
    keys ?? null,
    (cb || (() => undefined)) as ChromeStorageCallback,
  );
}

export function storageGetAll<T = Record<string, unknown>>(
  cb?: StorageCallback<T>,
) {
  return chrome.storage.local.get(
    null,
    (cb || (() => undefined)) as ChromeStorageCallback,
  );
}

export function storageSet(items: Record<string, unknown>, cb?: ErrorCallback) {
  return chrome.storage.local.set(items, cb);
}

export function storageClear(cb?: ErrorCallback) {
  return chrome.storage.local.clear(cb);
}

export function storageRemove(keys: string | string[], cb?: ErrorCallback) {
  return chrome.storage.local.remove(keys, cb);
}
