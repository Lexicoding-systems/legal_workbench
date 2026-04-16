import { describe, it, expect } from "vitest";
import {
  buildSourceBlock,
  buildChunkIdMap,
  resolveChunkIds,
  collectAllChunkIds,
} from "@/modules/generation/generator.utils";
import type { RetrievedChunk } from "@/modules/retrieval/retrieval.service";

function makeChunk(id: string, label: string, text: string): RetrievedChunk {
  return { id, citationLabel: label, text, pageNumber: 1, documentId: "d1", rank: 0 };
}

describe("buildSourceBlock", () => {
  it("returns empty string for empty array", () => {
    expect(buildSourceBlock([])).toBe("");
  });

  it("formats a single chunk with 1-based index", () => {
    const chunks = [makeChunk("a", "[Doc, p.1, chunk 0]", "hello")];
    expect(buildSourceBlock(chunks)).toBe("[1] [Doc, p.1, chunk 0]:\nhello");
  });

  it("joins two chunks with double newline", () => {
    const chunks = [
      makeChunk("a", "label-a", "text-a"),
      makeChunk("b", "label-b", "text-b"),
    ];
    const result = buildSourceBlock(chunks);
    expect(result).toBe("[1] label-a:\ntext-a\n\n[2] label-b:\ntext-b");
  });
});

describe("buildChunkIdMap", () => {
  it("returns empty map for empty array", () => {
    expect(buildChunkIdMap([]).size).toBe(0);
  });

  it("maps 1-based indices to chunk IDs", () => {
    const chunks = [makeChunk("id-a", "l", "t"), makeChunk("id-b", "l", "t")];
    const map = buildChunkIdMap(chunks);
    expect(map.get(1)).toBe("id-a");
    expect(map.get(2)).toBe("id-b");
  });

  it("index 0 is undefined (1-based)", () => {
    const chunks = [makeChunk("id-a", "l", "t")];
    expect(buildChunkIdMap(chunks).get(0)).toBeUndefined();
  });
});

describe("resolveChunkIds", () => {
  it("returns empty array for empty indices", () => {
    expect(resolveChunkIds([], new Map())).toEqual([]);
  });

  it("resolves all valid indices to UUIDs", () => {
    const map = new Map([[1, "uuid-1"], [2, "uuid-2"]]);
    expect(resolveChunkIds([1, 2], map)).toEqual(["uuid-1", "uuid-2"]);
  });

  it("silently drops out-of-range indices", () => {
    const map = new Map([[1, "uuid-1"]]);
    expect(resolveChunkIds([1, 99], map)).toEqual(["uuid-1"]);
  });

  it("preserves duplicates (dedup is caller's concern)", () => {
    const map = new Map([[1, "uuid-1"]]);
    expect(resolveChunkIds([1, 1], map)).toEqual(["uuid-1", "uuid-1"]);
  });
});

describe("collectAllChunkIds", () => {
  it("returns empty array for empty list", () => {
    expect(collectAllChunkIds([])).toEqual([]);
  });

  it("collects IDs from a single item", () => {
    expect(collectAllChunkIds([{ sourceChunkIds: ["a", "b"] }])).toEqual(["a", "b"]);
  });

  it("deduplicates IDs across multiple items", () => {
    const items = [
      { sourceChunkIds: ["a"] },
      { sourceChunkIds: ["a", "b"] },
    ];
    expect(collectAllChunkIds(items)).toEqual(["a", "b"]);
  });

  it("handles items with empty sourceChunkIds", () => {
    expect(collectAllChunkIds([{ sourceChunkIds: [] }])).toEqual([]);
  });
});
