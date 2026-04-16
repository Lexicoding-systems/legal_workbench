import { describe, it, expect } from "vitest";
import { chunkPages } from "@/modules/parsing/chunker";

const doc = "doc-1";
const file = "test.pdf";

describe("chunkPages", () => {
  it("returns empty array for no pages", () => {
    expect(chunkPages([], doc, file)).toEqual([]);
  });

  it("returns empty array for whitespace-only page", () => {
    expect(chunkPages([{ pageNumber: 1, text: "   " }], doc, file)).toEqual([]);
  });

  it("produces one chunk for text shorter than CHUNK_SIZE", () => {
    const chunks = chunkPages([{ pageNumber: 1, text: "short text" }], doc, file);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks[0].documentId).toBe(doc);
    expect(chunks[0].citationLabel).toBe("[test.pdf, p.1, chunk 0]");
  });

  it("produces one chunk for text exactly 500 characters", () => {
    const text = "a".repeat(500);
    const chunks = chunkPages([{ pageNumber: 1, text }], doc, file);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toHaveLength(500);
  });

  it("splits text longer than 500 characters into multiple chunks", () => {
    const text = "a".repeat(1100);
    const chunks = chunkPages([{ pageNumber: 1, text }], doc, file);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);
    expect(chunks[2].chunkIndex).toBe(2);
    expect(chunks[0].text).toHaveLength(500);
    expect(chunks[1].text).toHaveLength(500);
    expect(chunks[2].text).toHaveLength(100);
  });

  it("resets chunkIndex to 0 for each new page", () => {
    const pages = [
      { pageNumber: 1, text: "a".repeat(600) },
      { pageNumber: 2, text: "b".repeat(200) },
    ];
    const chunks = chunkPages(pages, doc, file);
    const page2Chunks = chunks.filter((c) => c.pageNumber === 2);
    expect(page2Chunks[0].chunkIndex).toBe(0);
  });

  it("carries correct pageNumber from the source page", () => {
    const pages = [
      { pageNumber: 3, text: "content on page three" },
    ];
    const chunks = chunkPages(pages, doc, file);
    expect(chunks[0].pageNumber).toBe(3);
  });

  it("citationLabel uses exact format [filename, p.N, chunk N]", () => {
    const chunks = chunkPages([{ pageNumber: 2, text: "hello" }], doc, "brief.pdf");
    expect(chunks[0].citationLabel).toBe("[brief.pdf, p.2, chunk 0]");
  });
});
