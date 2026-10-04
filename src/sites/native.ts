export const READER_REDIRECT_BYPASS_PARAM = "cs_open_native";

export function withNativeReaderBypass(url: string) {
  const parsed = new URL(url);
  parsed.searchParams.set(READER_REDIRECT_BYPASS_PARAM, "1");
  return parsed.href;
}
