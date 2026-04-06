import { prisma } from "@/lib/prisma";

/**
 * Creates Citation records linking a GeneratedArtifact to its source Chunks.
 * Deduplicates chunk IDs before inserting.
 */
export async function saveCitations(
  artifactId: string,
  chunkIds: string[]
): Promise<void> {
  const unique = Array.from(new Set(chunkIds));
  if (unique.length === 0) return;

  await prisma.citation.createMany({
    data: unique.map((chunkId) => ({ artifactId, chunkId })),
    skipDuplicates: true,
  });
}

/**
 * Retrieves all citations for an artifact, including the chunk's citation label and text.
 */
export async function getCitationsForArtifact(artifactId: string) {
  return prisma.citation.findMany({
    where: { artifactId },
    include: {
      chunk: {
        select: {
          id: true,
          citationLabel: true,
          text: true,
          pageNumber: true,
        },
      },
    },
  });
}
