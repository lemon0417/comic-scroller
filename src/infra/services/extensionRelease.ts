export const EXTENSION_RELEASE_STATE_KEY = "extensionReleaseState";
export const EXTENSION_RELEASE_METADATA_FILENAME =
  "latest-release.json";
export const EXTENSION_RELEASE_METADATA_URL =
  `https://github.com/lemon0417/comic-scroller/releases/latest/download/${EXTENSION_RELEASE_METADATA_FILENAME}`;
export const EXTENSION_RELEASE_INSTALL_URL =
  "https://lemon0417.github.io/comic-scroller/install/";
export const EXTENSION_RELEASE_CHECK_INTERVAL_MINUTES = 60 * 12;

export type ExtensionReleaseMetadata = {
  version: string;
  publishedAt: string;
  releaseUrl: string;
};

export type ExtensionReleaseNotice = {
  latestVersion: string;
  releaseUrl: string;
  instructionsUrl: string;
  publishedAt: string;
};

type StoredExtensionReleaseState = {
  checkedAt?: number;
  latest?: ExtensionReleaseMetadata | null;
  dismissedVersion?: string;
  notifiedVersion?: string;
};

type StorageItems = Record<string, unknown>;

type RefreshStoredExtensionReleaseStateOptions = {
  currentVersion?: string;
  fetchImpl?: typeof fetch;
  metadataUrl?: string;
  now?: () => number;
  readState?: () => Promise<StoredExtensionReleaseState>;
  writeState?: (state: StoredExtensionReleaseState) => Promise<void>;
};

type RefreshStoredExtensionReleaseStateResult = {
  checkedAt: number;
  latest: ExtensionReleaseMetadata | null;
  notice: ExtensionReleaseNotice | null;
  shouldNotify: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseVersionParts(version: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version || "").trim());
  if (!match) {
    return null;
  }
  return match.slice(1).map((part) => Number(part));
}

function getCurrentManifestVersion() {
  return chrome.runtime.getManifest().version;
}

function toNotice(
  metadata: ExtensionReleaseMetadata | null | undefined,
): ExtensionReleaseNotice | null {
  if (!metadata) {
    return null;
  }

  return {
    latestVersion: metadata.version,
    releaseUrl: metadata.releaseUrl,
    instructionsUrl: EXTENSION_RELEASE_INSTALL_URL,
    publishedAt: metadata.publishedAt,
  };
}

function normalizeMetadata(value: unknown): ExtensionReleaseMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const version = String(value.version || "").trim();
  const publishedAt = String(value.publishedAt || "").trim();
  const releaseUrl = String(value.releaseUrl || "").trim();

  if (
    !parseVersionParts(version) ||
    !publishedAt ||
    !releaseUrl
  ) {
    return null;
  }

  return {
    version,
    publishedAt,
    releaseUrl,
  };
}

function normalizeStoredState(value: unknown): StoredExtensionReleaseState {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...(typeof value.checkedAt === "number" && Number.isFinite(value.checkedAt)
      ? { checkedAt: value.checkedAt }
      : {}),
    ...(typeof value.dismissedVersion === "string" && value.dismissedVersion
      ? { dismissedVersion: value.dismissedVersion }
      : {}),
    ...(typeof value.notifiedVersion === "string" && value.notifiedVersion
      ? { notifiedVersion: value.notifiedVersion }
      : {}),
    latest: normalizeMetadata(value.latest) || null,
  };
}

function readStorageValue(key: string) {
  return new Promise<unknown>((resolve) => {
    chrome.storage.local.get([key], (items: StorageItems) => {
      resolve(items?.[key]);
    });
  });
}

function writeStorageValue(key: string, value: unknown) {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      const error = (
        chrome.runtime as typeof chrome.runtime & { lastError?: unknown }
      )?.lastError;
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function readStoredState() {
  return normalizeStoredState(
    await readStorageValue(EXTENSION_RELEASE_STATE_KEY),
  );
}

async function writeStoredState(state: StoredExtensionReleaseState) {
  await writeStorageValue(EXTENSION_RELEASE_STATE_KEY, state);
}

export function compareExtensionVersions(left: string, right: string) {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);

  if (!leftParts || !rightParts) {
    return String(left || "").localeCompare(String(right || ""));
  }

  for (let index = 0; index < 3; index += 1) {
    const diff = leftParts[index] - rightParts[index];
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

export async function fetchExtensionReleaseMetadata(
  fetchImpl: typeof fetch = fetch,
  metadataUrl = EXTENSION_RELEASE_METADATA_URL,
) {
  const response = await fetchImpl(metadataUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `extension release metadata request failed: ${response.status}`,
    );
  }

  const metadata = normalizeMetadata(await response.json());
  if (!metadata) {
    throw new Error("extension release metadata is invalid");
  }

  return metadata;
}

export async function getExtensionReleaseNotice(
  currentVersion = getCurrentManifestVersion(),
) {
  const state = await readStoredState();
  const notice = toNotice(state.latest);
  if (!notice) {
    return null;
  }

  if (compareExtensionVersions(notice.latestVersion, currentVersion) <= 0) {
    return null;
  }

  if (state.dismissedVersion === notice.latestVersion) {
    return null;
  }

  return notice;
}

export async function dismissExtensionReleaseNotice(latestVersion: string) {
  if (!latestVersion) {
    return;
  }

  const state = await readStoredState();
  await writeStoredState({
    ...state,
    dismissedVersion: latestVersion,
  });
}

export async function reconcileStoredExtensionReleaseState(
  currentVersion = getCurrentManifestVersion(),
) {
  const state = await readStoredState();
  if (
    !state.latest ||
    compareExtensionVersions(state.latest.version, currentVersion) > 0
  ) {
    return state;
  }

  const nextState: StoredExtensionReleaseState = {
    ...(state.checkedAt ? { checkedAt: state.checkedAt } : {}),
    latest: null,
  };

  await writeStoredState(nextState);
  return nextState;
}

export async function refreshStoredExtensionReleaseState(
  options: RefreshStoredExtensionReleaseStateOptions = {},
): Promise<RefreshStoredExtensionReleaseStateResult> {
  const currentVersion = options.currentVersion || getCurrentManifestVersion();
  const now = options.now || (() => Date.now());
  const fetchImpl = options.fetchImpl || fetch;
  const readStateFn = options.readState || readStoredState;
  const writeStateFn = options.writeState || writeStoredState;
  const previousState = normalizeStoredState(await readStateFn());
  const latest = await fetchExtensionReleaseMetadata(
    fetchImpl,
    options.metadataUrl,
  );
  const checkedAt = now();

  if (compareExtensionVersions(latest.version, currentVersion) <= 0) {
    const nextState: StoredExtensionReleaseState = {
      checkedAt,
      latest: null,
    };
    await writeStateFn(nextState);
    return {
      checkedAt,
      latest: null,
      notice: null,
      shouldNotify: false,
    };
  }

  const notice = previousState.dismissedVersion === latest.version
    ? null
    : toNotice(latest);
  const shouldNotify =
    Boolean(notice) && previousState.notifiedVersion !== latest.version;
  const nextState: StoredExtensionReleaseState = {
    checkedAt,
    latest,
    ...(previousState.dismissedVersion
      ? { dismissedVersion: previousState.dismissedVersion }
      : {}),
    ...((shouldNotify ? latest.version : previousState.notifiedVersion)
      ? {
          notifiedVersion: shouldNotify
            ? latest.version
            : previousState.notifiedVersion,
        }
      : {}),
  };

  await writeStateFn(nextState);

  return {
    checkedAt,
    latest,
    notice,
    shouldNotify,
  };
}

export function subscribeToExtensionReleaseState(listener: () => void) {
  const onChanged = chrome?.storage?.onChanged;
  if (!onChanged?.addListener || !onChanged?.removeListener) {
    return () => undefined;
  }

  const handleChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== "local" || !changes?.[EXTENSION_RELEASE_STATE_KEY]) {
      return;
    }
    listener();
  };

  onChanged.addListener(handleChange);
  return () => onChanged.removeListener(handleChange);
}
