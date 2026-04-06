import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface RetrievedChunk {
  id: string;
  text: string;
  citationLabel: string;
  pageNumber: number;
  documentId: string;
  rank: number;
}

/**
 * Retrieves chunks from a matter's corpus using Postgres full-text search.
 * Falls back to per-word ILIKE if FTS returns no results.
 */
export async function retrieveChunks(
  query: string,
  matterId: string,
  limit = 10
): Promise<RetrievedChunk[]> {
  // Primary: full-text search with ranking
  const ftsResults = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      c.id,
      c.text,
      c."citationLabel",
      c."pageNumber",
      c."documentId",
      ts_rank(to_tsvector('english', c.text), plainto_tsquery('english', ${query})) AS rank
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE d."matterId" = ${matterId}
      AND to_tsvector('english', c.text) @@ plainto_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  if (ftsResults.length > 0) return ftsResults;

  // Fallback: per-word ILIKE, OR-joined. Collect unique chunks, dedupe by id.
  const words = query
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2);

  if (words.length === 0) return [];

  // Build OR conditions for each word using ILIKE
  const conditions = words
    .map((w) => Prisma.sql`c.text ILIKE ${"%" + w + "%"}`)
    .reduce((acc, cond) => Prisma.sql`${acc} OR ${cond}`);

  const ilikeResults = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT DISTINCT
      c.id,
      c.text,
      c."citationLabel",
      c."pageNumber",
      c."documentId",
      0::float AS rank
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE d."matterId" = ${matterId}
      AND (${conditions})
    LIMIT ${limit}
  `;

  return ilikeResults;
}

/**
 * Retrieves all chunks for a matter in document/page order.
 * Used by generators that need broad coverage of the full corpus.
 */
export async function getAllChunksForMatter(
  matterId: string,
  limit = 50
): Promise<RetrievedChunk[]> {
  return prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      c.id,
      c.text,
      c."citationLabel",
      c."pageNumber",
      c."documentId",
      0::float AS rank
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE d."matterId" = ${matterId}
    ORDER BY d."createdAt" ASC, c."pageNumber" ASC, c."chunkIndex" ASC
    LIMIT ${limit}
  `;
}
