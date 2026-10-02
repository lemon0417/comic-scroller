export type LibrarySyncStatus = {
  enabled: boolean;
  available: boolean;
  lastSyncedAt?: number;
  remoteUpdatedAt?: number;
  lastError?: string;
  payloadBytes?: number;
  pendingPayloadBytes?: number;
  storageBytes?: number;
  pendingStorageBytes?: number;
  quotaBytes?: number;
};

export function createEmptyLibrarySyncStatus(
  overrides: Partial<LibrarySyncStatus> = {},
): LibrarySyncStatus {
  return {
    enabled: false,
    available: false,
    ...overrides,
  };
}
