import {
  compareExtensionVersions,
  dismissExtensionReleaseNotice,
  EXTENSION_RELEASE_INSTALL_URL,
  EXTENSION_RELEASE_STATE_KEY,
  type ExtensionReleaseMetadata,
  getExtensionReleaseNotice,
  reconcileStoredExtensionReleaseState,
  refreshStoredExtensionReleaseState,
} from "./extensionRelease";

function createMetadata(
  overrides: Partial<ExtensionReleaseMetadata> = {},
): ExtensionReleaseMetadata {
  return {
    version: "4.2.0",
    publishedAt: "2026-04-09T12:00:00.000Z",
    releaseUrl: "https://github.com/lemon0417/comic-scroller/releases/tag/v4.2.0",
    ...overrides,
  };
}

describe("extension release service", () => {
  let storageState: Record<string, unknown>;

  beforeEach(() => {
    storageState = {};
    (global as any).chrome = {
      runtime: {
        getManifest: jest.fn(() => ({ version: "4.1.0" })),
        lastError: undefined,
      },
      storage: {
        local: {
          get: jest.fn((keys: string[], callback: (items: Record<string, unknown>) => void) =>
            callback(
              keys.reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = storageState[key];
                return acc;
              }, {}),
            )),
          set: jest.fn((items: Record<string, unknown>, callback?: () => void) => {
            storageState = {
              ...storageState,
              ...items,
            };
            callback?.();
          }),
        },
        onChanged: {
          addListener: jest.fn(),
          removeListener: jest.fn(),
        },
      },
    };
  });

  it("compares semantic versions numerically", () => {
    expect(compareExtensionVersions("4.2.0", "4.1.9")).toBeGreaterThan(0);
    expect(compareExtensionVersions("4.1.0", "4.1.0")).toBe(0);
    expect(compareExtensionVersions("4.0.9", "4.1.0")).toBeLessThan(0);
  });

  it("returns an available notice from stored release metadata", async () => {
    storageState[EXTENSION_RELEASE_STATE_KEY] = {
      latest: createMetadata(),
    };

    await expect(getExtensionReleaseNotice("4.1.0")).resolves.toEqual({
      latestVersion: "4.2.0",
      releaseUrl: "https://github.com/lemon0417/comic-scroller/releases/tag/v4.2.0",
      instructionsUrl: EXTENSION_RELEASE_INSTALL_URL,
      publishedAt: "2026-04-09T12:00:00.000Z",
    });
  });

  it("dismisses the current release notice until a newer version appears", async () => {
    storageState[EXTENSION_RELEASE_STATE_KEY] = {
      latest: createMetadata(),
    };

    await dismissExtensionReleaseNotice("4.2.0");

    await expect(getExtensionReleaseNotice("4.1.0")).resolves.toBeNull();
    expect(storageState[EXTENSION_RELEASE_STATE_KEY]).toMatchObject({
      dismissedVersion: "4.2.0",
    });
  });

  it("stores the latest release and requests a one-time notification", async () => {
    const writtenStates: unknown[] = [];
    const result = await refreshStoredExtensionReleaseState({
      currentVersion: "4.1.0",
      fetchImpl: jest.fn(async () => ({
        ok: true,
        json: async () => createMetadata(),
      })) as unknown as typeof fetch,
      now: () => 123,
      readState: async () => ({}),
      writeState: async (state) => {
        writtenStates.push(state);
      },
    });

    expect(result).toEqual({
      checkedAt: 123,
      latest: createMetadata(),
      notice: {
        latestVersion: "4.2.0",
        releaseUrl: "https://github.com/lemon0417/comic-scroller/releases/tag/v4.2.0",
        instructionsUrl: EXTENSION_RELEASE_INSTALL_URL,
        publishedAt: "2026-04-09T12:00:00.000Z",
      },
      shouldNotify: true,
    });
    expect(writtenStates).toEqual([
      {
        checkedAt: 123,
        latest: createMetadata(),
        notifiedVersion: "4.2.0",
      },
    ]);
  });

  it("suppresses repeat notifications for a dismissed version", async () => {
    const result = await refreshStoredExtensionReleaseState({
      currentVersion: "4.1.0",
      fetchImpl: jest.fn(async () => ({
        ok: true,
        json: async () => createMetadata(),
      })) as unknown as typeof fetch,
      now: () => 456,
      readState: async () => ({
        dismissedVersion: "4.2.0",
        notifiedVersion: "4.2.0",
      }),
      writeState: async () => undefined,
    });

    expect(result.notice).toBeNull();
    expect(result.shouldNotify).toBe(false);
  });

  it("clears stale release metadata after the installed version catches up", async () => {
    storageState[EXTENSION_RELEASE_STATE_KEY] = {
      checkedAt: 123,
      latest: createMetadata(),
      dismissedVersion: "4.2.0",
      notifiedVersion: "4.2.0",
    };

    await reconcileStoredExtensionReleaseState("4.2.0");

    expect(storageState[EXTENSION_RELEASE_STATE_KEY]).toEqual({
      checkedAt: 123,
      latest: null,
    });
  });
});
