import type { LibrarySignal } from "./schema";
import { LIBRARY_SIGNAL_KEY } from "./schema";

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
