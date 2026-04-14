import { RetrievedChunk } from "@/modules/retrieval/retrieval.service";

/**
 * Formats an indexed source block string for inclusion in LLM prompts.
 * Each chunk is prefixed with a 1-based integer reference [1], [2], ...
 */
export function buildSourceBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] ${c.citationLabel}:\n${c.text}`)
    .join("\n\n");
}

/**
 * Builds a Map from 1-based prompt index → database chunk ID.
 * Used to translate integer references in LLM output back to real UUIDs.
 */
export function buildChunkIdMap(chunks: RetrievedChunk[]): Map<number, string> {
  const map = new Map<number, string>();
  chunks.forEach((c, i) => map.set(i + 1, c.id));
  return map;
}

/**
 * Resolves an array of integer chunk references to UUID strings.
 * Silently drops any index not present in the map (out-of-range LLM output).
 */
export function resolveChunkIds(
  indices: number[],
  indexToId: Map<number, string>
): string[] {
  return indices
    .map((n) => indexToId.get(n))
    .filter((id): id is string => !!id);
}

/**
 * Collects all unique chunk IDs from a list of items that carry sourceChunkIds.
 */
export function collectAllChunkIds<T extends { sourceChunkIds: string[] }>(
  items: T[]
): string[] {
  return Array.from(new Set(items.flatMap((item) => item.sourceChunkIds)));
}
