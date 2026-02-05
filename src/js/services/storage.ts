
declare var chrome: any;

type StorageCallback<T> = (_items: T) => void;

type ErrorCallback = (_err?: any) => void;

export function storageGet<T = any>(keys?: any, cb?: StorageCallback<T>) {
  if (typeof keys === 'function') {
    return chrome.storage.local.get(null, keys);
  }
  return chrome.storage.local.get(keys ?? null, cb);
}

export function storageGetAll<T = any>(cb?: StorageCallback<T>) {
  return chrome.storage.local.get(null, cb);
}

export function storageSet(items: any, cb?: ErrorCallback) {
  return chrome.storage.local.set(items, cb);
}

export function storageClear(cb?: ErrorCallback) {
  return chrome.storage.local.clear(cb);
}
