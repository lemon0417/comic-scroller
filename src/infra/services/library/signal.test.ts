import { createEmptyLibrarySnapshot } from "./schema";
import {
  subscribeToLibraryChanges,
  subscribeToLibrarySignal,
} from "./signal";

jest.mock("./compat", () => ({
  loadLibrary: jest.fn(),
}));

const compat = jest.requireMock("./compat") as {
  loadLibrary: jest.Mock;
};

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

  it("hydrates a compatibility snapshot when subscribing to full library changes", async () => {
    const snapshot = createEmptyLibrarySnapshot("4.0.52");
    const listener = jest.fn();
    compat.loadLibrary.mockResolvedValue(snapshot);

    subscribeToLibraryChanges(listener);
    handler?.(
      {
        librarySignal: {
          newValue: {
            revision: "rev-2",
            changedAt: 2,
            source: "test",
            dbSchemaVersion: 1,
            scopes: ["series"],
          },
        },
      },
      "local",
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(compat.loadLibrary).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(snapshot);
  });
});
