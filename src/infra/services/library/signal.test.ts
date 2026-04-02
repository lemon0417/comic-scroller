import { subscribeToLibrarySignal } from "./signal";

describe("library signal", () => {
  let addListener: jest.Mock;
  let removeListener: jest.Mock;
  let handler: ((changes: any, areaName: string) => void) | null;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = null;
    addListener = jest.fn((listener) => {
      handler = listener;
    });
    removeListener = jest.fn();
    (global as any).chrome = {
      storage: {
        onChanged: {
          addListener,
          removeListener,
        },
      },
    };
  });

  it("forwards library signals from chrome.storage.onChanged", () => {
    const listener = jest.fn();

    const unsubscribe = subscribeToLibrarySignal(listener);

    expect(addListener).toHaveBeenCalledTimes(1);
    handler?.(
      {
        librarySignal: {
          newValue: {
            revision: "rev-1",
            changedAt: 1,
            source: "test",
            dbSchemaVersion: 1,
            scopes: ["updates"],
            seriesKeys: ["dm5:m123"],
          },
        },
      },
      "local",
    );

    expect(listener).toHaveBeenCalledWith({
      revision: "rev-1",
      changedAt: 1,
      source: "test",
      dbSchemaVersion: 1,
      scopes: ["updates"],
      seriesKeys: ["dm5:m123"],
    });

    unsubscribe();
    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});
