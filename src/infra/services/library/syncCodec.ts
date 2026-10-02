import {
  createByteStream,
  decodeUtf8,
  encodeUtf8,
  readStreamToArrayBuffer,
} from "./byteStreams";

export const LIBRARY_SYNC_ENCODING = "indexed-json-gzip-base64";
export const LIBRARY_SYNC_MAX_RAW_BYTES = 8 * 1024 * 1024;
const MAX_ENCODED_BYTES = 100 * 1024;

export function getUtf8ByteLength(text: string) {
  return encodeUtf8(text).byteLength;
}

function bytesToBase64(bytes: Uint8Array) {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16384) {
    parts.push(
      String.fromCharCode(
        ...Array.from(bytes.subarray(offset, offset + 16384)),
      ),
    );
  }
  return btoa(parts.join(""));
}

function base64ToBytes(text: string) {
  if (
    !text ||
    text.length > MAX_ENCODED_BYTES ||
    text.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(text)
  ) {
    throw new Error("同步資料的 base64 格式不正確或超過儲存上限。");
  }
  let binary: string;
  try {
    binary = atob(text);
    if (btoa(binary) !== text) throw new Error("Non-canonical base64");
  } catch {
    throw new Error("同步資料的 base64 格式不正確。");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function encodeLibrarySyncJson(json: string): Promise<string> {
  const bytes = encodeUtf8(json);
  if (bytes.byteLength > LIBRARY_SYNC_MAX_RAW_BYTES) {
    throw new Error(
      `同步原始資料 ${bytes.byteLength} bytes 超過 ${LIBRARY_SYNC_MAX_RAW_BYTES} bytes 處理上限。`,
    );
  }
  if (
    typeof CompressionStream !== "function" ||
    typeof ReadableStream !== "function"
  ) {
    throw new Error("目前瀏覽器不支援壓縮同步，請更新 Chrome。");
  }
  const compressed = await readStreamToArrayBuffer(
    createByteStream(bytes).pipeThrough(new CompressionStream("gzip")),
  );
  return bytesToBase64(new Uint8Array(compressed));
}

export async function decodeLibrarySyncJson(
  encoded: string,
  expectedBytes: number,
): Promise<unknown> {
  if (
    !Number.isSafeInteger(expectedBytes) ||
    expectedBytes <= 0 ||
    expectedBytes > LIBRARY_SYNC_MAX_RAW_BYTES
  ) {
    throw new Error("同步原始資料大小不正確或超過處理上限。");
  }
  if (
    typeof DecompressionStream !== "function" ||
    typeof ReadableStream !== "function"
  ) {
    throw new Error("目前瀏覽器不支援壓縮同步，請更新 Chrome。");
  }
  const decompressed = await readStreamToArrayBuffer(
    createByteStream(base64ToBytes(encoded)).pipeThrough(
      new DecompressionStream("gzip"),
    ),
    LIBRARY_SYNC_MAX_RAW_BYTES,
  );
  if (decompressed.byteLength !== expectedBytes) {
    throw new Error("同步資料大小與 manifest 不符，請稍後再試。");
  }
  return JSON.parse(decodeUtf8(new Uint8Array(decompressed), true));
}
