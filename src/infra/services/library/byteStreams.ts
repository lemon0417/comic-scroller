export function encodeUtf8(text: string) {
  if (typeof TextEncoder === "function") {
    return new TextEncoder().encode(text);
  }
  if (typeof Buffer === "function") {
    return Uint8Array.from(Buffer.from(text, "utf8"));
  }
  throw new Error("UTF-8 encoding is not supported in this environment.");
}

export function decodeUtf8(bytes: Uint8Array, fatal = false) {
  if (typeof TextDecoder === "function") {
    return new TextDecoder("utf-8", { fatal }).decode(bytes);
  }
  if (typeof Buffer === "function") {
    return Buffer.from(bytes).toString("utf8");
  }
  throw new Error("UTF-8 decoding is not supported in this environment.");
}

export function createByteStream(bytes: Uint8Array) {
  return new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(Uint8Array.from(bytes));
      controller.close();
    },
  });
}

function bufferSourceToUint8Array(value: BufferSource) {
  if (ArrayBuffer.isView(value)) {
    return Uint8Array.from(
      new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
    );
  }
  return Uint8Array.from(new Uint8Array(value));
}

export async function readStreamToArrayBuffer(
  stream: ReadableStream<BufferSource>,
  maxBytes = Number.POSITIVE_INFINITY,
) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const chunk = bufferSourceToUint8Array(value);
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`解壓資料超過 ${maxBytes} bytes 上限。`);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return combined.buffer;
}
