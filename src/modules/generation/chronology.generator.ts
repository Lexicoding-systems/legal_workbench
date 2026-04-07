import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { getAllChunksForMatter, RetrievedChunk } from "@/modules/retrieval/retrieval.service";
import { saveCitations } from "@/modules/citations/citations.service";
import { extractJson } from "@/lib/parse-json";
import { ArtifactType } from "@prisma/client";

export interface ChronologyItem {
  date: string;
  event: string;
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

export async function generateChronology(matterId: string): Promise<{
  artifactId: string;
  items: ChronologyItem[];
}> {
  const chunks = await getAllChunksForMatter(matterId, 40);
  if (chunks.length === 0) {
    throw new Error("No chunks found for this matter. Upload and process documents first.");
  }

  const sourceBlock = buildSourceBlock(chunks);
  const indexToId = buildChunkIdMap(chunks);

  const systemPrompt = `You are a legal analyst. Extract only information directly supported by the provided source material.
Return ONLY valid JSON — no markdown, no code fences, no explanation.`;

  const userPrompt = `## Source Material
${sourceBlock}

## Task
Extract a chronological list of events from the source material above.
Only include events that have a discernible date or time reference.
For each event, record the source block numbers (e.g. [1], [3]) that support it.

## Required JSON Schema
Return a JSON array of objects with these exact fields:
- "date": string (the date or time period, e.g. "January 15, 2023" or "Early 2022")
- "event": string (concise description of what happened)
- "sourceChunkIds": array of source block numbers as integers (e.g. [1, 3])

Example: [{"date":"March 2022","event":"Plaintiff signed the employment agreement.","sourceChunkIds":[2]}]`;

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

  let items: Array<{ date: string; event: string; sourceChunkIds: number[] }>;
  try {
    items = extractJson(rawText) as typeof items;
  } catch (err) {
    console.error("[generateChronology] JSON extraction failed:", err);
    throw new Error("Could not parse model response as JSON. Check server logs.");
  }

  // Resolve source block numbers → real chunk UUIDs
  const resolvedItems: ChronologyItem[] = items.map((item) => ({
    date: item.date,
    event: item.event,
    sourceChunkIds: item.sourceChunkIds
      .map((n) => indexToId.get(n))
      .filter((id): id is string => !!id),
  }));

  // Save artifact
  const artifact = await prisma.generatedArtifact.create({
    data: {
      matterId,
      type: ArtifactType.CHRONOLOGY,
      content: resolvedItems as any,
    },
  });

  // Save citations
  const allChunkIds = Array.from(
    new Set(resolvedItems.flatMap((item) => item.sourceChunkIds))
  );
  await saveCitations(artifact.id, allChunkIds);

  return { artifactId: artifact.id, items: resolvedItems };
}
