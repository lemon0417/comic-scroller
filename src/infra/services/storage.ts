type StorageCallback<T> = (_items: T) => void;

type ErrorCallback = (_err?: unknown) => void;

export function storageGetAll<T = Record<string, unknown>>(
  cb?: StorageCallback<T>,
) {
  return chrome.storage.local.get(
    undefined,
    (items) => (cb || (() => undefined))(items as T),
  );
}

export function storageSet(items: Record<string, unknown>, cb?: ErrorCallback) {
  return chrome.storage.local.set(items, cb);
}

export function storageRemove(keys: string | string[], cb?: ErrorCallback) {
  return chrome.storage.local.remove(keys, cb);
}
