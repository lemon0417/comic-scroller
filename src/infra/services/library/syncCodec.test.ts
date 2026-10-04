import {
  CompressionStream,
  DecompressionStream,
  ReadableStream,
} from "stream/web";
import { TextDecoder, TextEncoder } from "util";

import {
  createByteStream,
  encodeUtf8,
  readStreamToArrayBuffer,
} from "./byteStreams";
import {
  decodeLibrarySyncJson,
  encodeLibrarySyncJson,
  getUtf8ByteLength,
  LIBRARY_SYNC_MAX_RAW_BYTES,
} from "./syncCodec";
import {
  compactLibrarySyncState,
  createEmptyLibrarySyncState,
  syncIndexedRowsToState,
  syncStateToIndexedRows,
} from "./syncModel";
import { createLargeSyncFixture } from "./syncTestFixtures";

Object.assign(globalThis, {
  CompressionStream,
  DecompressionStream,
  ReadableStream,
  TextEncoder,
  TextDecoder,
});

it("round-trips all 395 subscriptions and 4200 ordered updates", async () => {
  const state = createLargeSyncFixture();
  const json = JSON.stringify(syncStateToIndexedRows(state));
  const encoded = await encodeLibrarySyncJson(json);
  expect(encoded.length).toBeLessThan(90 * 1024 - 1024);
  const restored = syncIndexedRowsToState(
    await decodeLibrarySyncJson(encoded, getUtf8ByteLength(json)),
  );
  expect(restored).toEqual(compactLibrarySyncState(state));
  expect(restored.subscriptions).toHaveLength(395);
  expect(restored.updates).toHaveLength(4200);
});

it.each([
  createEmptyLibrarySyncState(),
  {
    ...createEmptyLibrarySyncState(),
    seriesByKey: {
      "comicbus:123": {
        site: "comicbus" as const,
        comicsID: "123",
        title: '😀中文"\\\n',
        cover: "",
        url: "",
        latestChapterID: "",
        lastReadChapterID: "",
        readChapterIDs: [],
        chapterSummaries: {},
      },
      "dm5:m123": {
        site: "dm5" as const,
        comicsID: "m123",
        title: "Different site",
        cover: "",
        url: "",
        latestChapterID: "",
        lastReadChapterID: "c1",
        readChapterIDs: ["c1"],
        chapterSummaries: {
          c1: { title: "😀中文", href: 'https://www.dm5.com/c1/?x="quoted"' },
        },
      },
    },
    subscriptions: ["comicbus:123", "dm5:m123"],
  },
])(
  "round-trips empty or Unicode libraries without inventing latest checkpoints (%#)",
  async (state) => {
    const json = JSON.stringify(syncStateToIndexedRows(state));
    const encoded = await encodeLibrarySyncJson(json);
    expect(
      syncIndexedRowsToState(
        await decodeLibrarySyncJson(encoded, getUtf8ByteLength(json)),
      ),
    ).toEqual(compactLibrarySyncState(state));
  },
);

it("does not silently truncate long varied chapter summaries", async () => {
  const state = createLargeSyncFixture(true);
  const json = JSON.stringify(syncStateToIndexedRows(state));
  const encoded = await encodeLibrarySyncJson(json);
  expect(encoded.length).toBeGreaterThan(90 * 1024);
  expect(state.updates).toHaveLength(4200);
});

it.each(["!!!!", "YQ", "YQ==extra", "YR==", "a".repeat(102404)])(
  "rejects invalid or oversized base64 (%#)",
  async (encoded) => {
    await expect(decodeLibrarySyncJson(encoded, 1)).rejects.toThrow(/base64/);
  },
);

it("rejects broken gzip, an incorrect raw size, and invalid JSON", async () => {
  await expect(decodeLibrarySyncJson(btoa("not gzip"), 8)).rejects.toThrow();
  const encoded = await encodeLibrarySyncJson("[[],[],[],[]]");
  await expect(decodeLibrarySyncJson(encoded, 1)).rejects.toThrow(/manifest/);
  const invalid = await encodeLibrarySyncJson("not JSON");
  await expect(decodeLibrarySyncJson(invalid, 8)).rejects.toThrow();
});

it("rejects raw inputs over 8 MiB before compression", async () => {
  await expect(
    encodeLibrarySyncJson("x".repeat(LIBRARY_SYNC_MAX_RAW_BYTES + 1)),
  ).rejects.toThrow(/處理上限/);
});

it("bounds decompression while streaming instead of trusting the manifest", async () => {
  const raw = encodeUtf8("x".repeat(LIBRARY_SYNC_MAX_RAW_BYTES + 1));
  const compressed = await readStreamToArrayBuffer(
    createByteStream(raw).pipeThrough(new globalThis.CompressionStream("gzip")),
  );
  const encoded = Buffer.from(compressed).toString("base64");
  await expect(decodeLibrarySyncJson(encoded, 1)).rejects.toThrow(
    /解壓資料超過/,
  );
});

it("reports missing compression support without falling back to v1", async () => {
  const original = globalThis.CompressionStream;
  try {
    Object.assign(globalThis, { CompressionStream: undefined });
    await expect(encodeLibrarySyncJson("[]")).rejects.toThrow(/更新 Chrome/);
  } finally {
    Object.assign(globalThis, { CompressionStream: original });
  }
});
