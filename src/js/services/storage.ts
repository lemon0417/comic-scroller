
declare var chrome: any;

type StorageCallback<T> = (items: T) => void;

type ErrorCallback = (err?: any) => void;

export function storageGet<T = any>(keys?: any, cb?: StorageCallback<T>) {
  return chrome.storage.local.get(keys, cb);
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
