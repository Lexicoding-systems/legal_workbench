import { ParsedPage } from "./pdf.parser";
import { CHUNK_SIZE } from "@/config/constants";

export interface RawChunk {
  documentId: string;
  pageNumber: number;
  text: string;
  chunkIndex: number;
  citationLabel: string;
}

/**
 * Splits page text into fixed-size character chunks.
 * Each chunk records its source document, page number, and position.
 * The citationLabel is human-readable and included in generation prompts.
 */
export function chunkPages(
  pages: ParsedPage[],
  documentId: string,
  filename: string
): RawChunk[] {
  const chunks: RawChunk[] = [];

  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;

    let globalChunkIndex = 0;
    for (let offset = 0; offset < text.length; offset += CHUNK_SIZE) {
      const slice = text.slice(offset, offset + CHUNK_SIZE).trim();
      if (!slice) continue;

      chunks.push({
        documentId,
        pageNumber: page.pageNumber,
        text: slice,
        chunkIndex: globalChunkIndex,
        citationLabel: `[${filename}, p.${page.pageNumber}, chunk ${globalChunkIndex}]`,
      });
      globalChunkIndex++;
    }
  }

  return chunks;
}
