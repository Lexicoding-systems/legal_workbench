import { generateText } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { getAllChunksForMatter, RetrievedChunk } from "@/modules/retrieval/retrieval.service";
import { saveCitations } from "@/modules/citations/citations.service";
import { extractJson } from "@/lib/parse-json";
import { ArtifactType } from "@prisma/client";

export type FactClassification = "observation" | "inference" | "allegation";

export interface FactItem {
  statement: string;
  classification: FactClassification;
  sourceChunkIds: string[];
}

function buildSourceBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] ${c.citationLabel}:\n${c.text}`)
    .join("\n\n");
}

function buildChunkIdMap(chunks: RetrievedChunk[]): Map<number, string> {
  const map = new Map<number, string>();
  chunks.forEach((c, i) => map.set(i + 1, c.id));
  return map;
}

export async function generateFacts(matterId: string): Promise<{
  artifactId: string;
  items: FactItem[];
}> {
  const chunks = await getAllChunksForMatter(matterId, 40);
  if (chunks.length === 0) {
    throw new Error("No chunks found for this matter. Upload and process documents first.");
  }

  const sourceBlock = buildSourceBlock(chunks);
  const indexToId = buildChunkIdMap(chunks);

  const { text: rawText } = await generateText(
    [
      {
        role: "system",
        content:
          "You are a legal analyst. Extract only information directly supported by the provided source material.\n" +
          "Classify each fact as:\n" +
          '- "observation": directly stated in the source material\n' +
          '- "inference": reasonably implied but not explicitly stated\n' +
          '- "allegation": claimed by one party but not independently verified\n' +
          "Return ONLY valid JSON — no markdown, no code fences, no explanation.",
      },
      {
        role: "user",
        content:
          `## Source Material\n${sourceBlock}\n\n` +
          `## Task\n` +
          `Extract a list of material facts from the source material above.\n` +
          `For each fact, classify it and record the source block numbers that support it.\n\n` +
          `## Required JSON Schema\n` +
          `Return a JSON array of objects with these exact fields:\n` +
          `- "statement": string (the fact stated clearly and concisely)\n` +
          `- "classification": "observation" | "inference" | "allegation"\n` +
          `- "sourceChunkIds": array of source block numbers as integers\n\n` +
          `Example: [{"statement":"Defendant terminated plaintiff's employment on March 1, 2023.","classification":"observation","sourceChunkIds":[1,2]}]`,
      },
    ],
    4096
  );

  let items: Array<{
    statement: string;
    classification: string;
    sourceChunkIds: number[];
  }>;
  try {
    items = extractJson(rawText) as typeof items;
  } catch (err) {
    console.error("[generateFacts] JSON extraction failed:", err);
    throw new Error("Could not parse model response as JSON. Check server logs.");
  }

  const validClassifications = new Set<string>([
    "observation",
    "inference",
    "allegation",
  ]);

  const resolvedItems: FactItem[] = items.map((item) => ({
    statement: item.statement,
    classification: validClassifications.has(item.classification)
      ? (item.classification as FactClassification)
      : "observation",
    sourceChunkIds: item.sourceChunkIds
      .map((n) => indexToId.get(n))
      .filter((id): id is string => !!id),
  }));

  const artifact = await prisma.generatedArtifact.create({
    data: {
      matterId,
      type: ArtifactType.FACT_TABLE,
      content: resolvedItems as any,
    },
  });

  const allChunkIds = Array.from(
    new Set(resolvedItems.flatMap((item) => item.sourceChunkIds))
  );
  await saveCitations(artifact.id, allChunkIds);

  return { artifactId: artifact.id, items: resolvedItems };
}
