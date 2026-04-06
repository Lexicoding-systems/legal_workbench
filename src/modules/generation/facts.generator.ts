import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { getAllChunksForMatter, RetrievedChunk } from "@/modules/retrieval/retrieval.service";
import { saveCitations } from "@/modules/citations/citations.service";
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

  const systemPrompt = `You are a legal analyst. Extract only information directly supported by the provided source material.
Classify each fact as:
- "observation": directly stated in the source material
- "inference": reasonably implied by the source material but not explicitly stated
- "allegation": claimed by one party but not independently verified
Return ONLY valid JSON — no markdown, no code fences, no explanation.`;

  const userPrompt = `## Source Material
${sourceBlock}

## Task
Extract a list of material facts from the source material above.
For each fact, classify it and record the source block numbers that support it.

## Required JSON Schema
Return a JSON array of objects with these exact fields:
- "statement": string (the fact stated clearly and concisely)
- "classification": "observation" | "inference" | "allegation"
- "sourceChunkIds": array of source block numbers as integers

Example: [{"statement":"Defendant terminated plaintiff's employment on March 1, 2023.","classification":"observation","sourceChunkIds":[1,2]}]`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as any).text)
    .join("");

  let items: Array<{
    statement: string;
    classification: string;
    sourceChunkIds: number[];
  }>;
  try {
    items = JSON.parse(rawText);
  } catch {
    console.error("[generateFacts] Failed to parse JSON:", rawText);
    throw new Error("Model returned invalid JSON. Raw response logged.");
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
