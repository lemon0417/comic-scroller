import {
  storageClear,
  storageGet,
  storageGetAll,
  storageRemove,
  storageSet,
} from "./storage";

describe("storage service", () => {
  beforeEach(() => {
    (global as any).chrome = {
      storage: {
        local: {
          get: jest.fn((_keys, cb) => cb && cb({})),
          set: jest.fn((_items, cb) => cb && cb(null)),
          clear: jest.fn((cb) => cb && cb(null)),
          remove: jest.fn((_keys, cb) => cb && cb(null)),
        },
      },
    };
  });

  it("calls chrome.storage.local.get with keys", () => {
    const cb = jest.fn();
    storageGet({ foo: true }, cb);
    expect((global as any).chrome.storage.local.get).toHaveBeenCalledWith(
      { foo: true },
      expect.any(Function),
    );
    expect(cb).toHaveBeenCalledWith({});
  });

  it("calls chrome.storage.local.get with undefined for getAll", () => {
    const cb = jest.fn();
    storageGetAll(cb);
    expect((global as any).chrome.storage.local.get).toHaveBeenCalledWith(
      undefined,
      expect.any(Function),
    );
    expect(cb).toHaveBeenCalledWith({});
  });

  it("calls chrome.storage.local.set", () => {
    const cb = jest.fn();
    storageSet({ a: 1 }, cb);
    expect((global as any).chrome.storage.local.set).toHaveBeenCalledWith(
      { a: 1 },
      cb,
    );
  });

  it("calls chrome.storage.local.clear", () => {
    const cb = jest.fn();
    storageClear(cb);
    expect((global as any).chrome.storage.local.clear).toHaveBeenCalledWith(cb);
  });

  it("calls chrome.storage.local.remove", () => {
    const cb = jest.fn();
    storageRemove(["a", "b"], cb);
    expect((global as any).chrome.storage.local.remove).toHaveBeenCalledWith(
      ["a", "b"],
      cb,
    );
  });
});
