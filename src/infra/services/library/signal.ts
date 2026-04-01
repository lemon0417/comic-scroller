declare var chrome: any;

import type { LibrarySignal, LibrarySnapshotV2 } from "./schema";
import { LIBRARY_SIGNAL_KEY } from "./schema";
import { loadLibrary } from "./compat";

export function subscribeToLibrarySignal(listener: (signal: LibrarySignal) => void) {
  const onChanged = chrome?.storage?.onChanged;
  if (!onChanged?.addListener || !onChanged?.removeListener) {
    return () => undefined;
  }
  const handleChange = (changes: any, areaName: string) => {
    if (areaName !== "local" || !changes?.[LIBRARY_SIGNAL_KEY]?.newValue) return;
    listener(changes[LIBRARY_SIGNAL_KEY].newValue as LibrarySignal);
  };
  onChanged.addListener(handleChange);
  return () => onChanged.removeListener(handleChange);
}

export function subscribeToLibraryChanges(
  listener: (snapshot: LibrarySnapshotV2) => void,
) {
  return subscribeToLibrarySignal(async () => {
    listener(await loadLibrary());
  });
}
