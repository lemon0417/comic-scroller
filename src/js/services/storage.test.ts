import {
  storageGet,
  storageGetAll,
  storageSet,
  storageClear,
} from './storage';

describe('storage service', () => {
  beforeEach(() => {
    (global as any).chrome = {
      storage: {
        local: {
          get: jest.fn((_keys, cb) => cb && cb({})),
          set: jest.fn((_items, cb) => cb && cb(null)),
          clear: jest.fn(cb => cb && cb(null)),
        },
      },
    };
  });

  it('calls chrome.storage.local.get with keys', () => {
    const cb = jest.fn();
    storageGet({ foo: true }, cb);
    expect((global as any).chrome.storage.local.get).toHaveBeenCalledWith({ foo: true }, cb);
  });

  it('calls chrome.storage.local.get with null for getAll', () => {
    const cb = jest.fn();
    storageGetAll(cb);
    expect((global as any).chrome.storage.local.get).toHaveBeenCalledWith(null, cb);
  });

  it('calls chrome.storage.local.set', () => {
    const cb = jest.fn();
    storageSet({ a: 1 }, cb);
    expect((global as any).chrome.storage.local.set).toHaveBeenCalledWith({ a: 1 }, cb);
  });

  it('calls chrome.storage.local.clear', () => {
    const cb = jest.fn();
    storageClear(cb);
    expect((global as any).chrome.storage.local.clear).toHaveBeenCalledWith(cb);
  });
});
