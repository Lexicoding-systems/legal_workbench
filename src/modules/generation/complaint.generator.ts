import { generateText } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { getAllChunksForMatter, RetrievedChunk } from "@/modules/retrieval/retrieval.service";
import { saveCitations } from "@/modules/citations/citations.service";
import { extractJson } from "@/lib/parse-json";
import { ArtifactType } from "@prisma/client";
import { FactItem } from "./facts.generator";

export interface ComplaintSection {
  heading: string;
  paragraphs: string[];
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

export async function generateComplaint(matterId: string): Promise<{
  artifactId: string;
  sections: ComplaintSection[];
}> {
  const chunks = await getAllChunksForMatter(matterId, 40);
  if (chunks.length === 0) {
    throw new Error("No chunks found for this matter. Upload and process documents first.");
  }

  // Pull the most recent fact table if available, to ground the complaint
  const latestFactArtifact = await prisma.generatedArtifact.findFirst({
    where: { matterId, type: ArtifactType.FACT_TABLE },
    orderBy: { createdAt: "desc" },
  });

  const sourceBlock = buildSourceBlock(chunks);
  const indexToId = buildChunkIdMap(chunks);

  let factsSummary = "";
  if (latestFactArtifact) {
    const facts = latestFactArtifact.content as unknown as FactItem[];
    const obs = facts.filter((f) => f.classification === "observation");
    const alleg = facts.filter((f) => f.classification === "allegation");
    factsSummary =
      `\n## Established Facts (from prior analysis)\n` +
      obs.map((f) => `- [observation] ${f.statement}`).join("\n") +
      "\n\n" +
      alleg.map((f) => `- [allegation] ${f.statement}`).join("\n") +
      "\n";
  }

  const { text: rawText } = await generateText(
    [
      {
        role: "system",
        content:
          "You are a legal drafting assistant. Draft a complaint skeleton grounded strictly in the provided source material. " +
          "Use placeholder names in brackets (e.g. [PLAINTIFF], [DEFENDANT]) where proper nouns are not clear from the sources. " +
          "Do not fabricate legal theories not supported by the facts. " +
          'Clearly mark allegations as "Upon information and belief" where they are not directly evidenced. ' +
          "Return ONLY valid JSON — no markdown, no code fences, no explanation.",
      },
      {
        role: "user",
        content:
          `## Source Material\n${sourceBlock}\n${factsSummary}\n` +
          `## Task\n` +
          `Draft a complaint skeleton. Include standard sections: parties, jurisdiction, factual background, causes of action, and prayer for relief.\n` +
          `For each section, record the source block numbers (as integers) that support it.\n\n` +
          `## Required JSON Schema\n` +
          `Return a JSON array of objects with these exact fields:\n` +
          `- "heading": string (section title, e.g. "I. PARTIES")\n` +
          `- "paragraphs": array of strings (draft paragraph text for that section)\n` +
          `- "sourceChunkIds": array of source block numbers as integers that support this section\n\n` +
          `Example: [{"heading":"I. PARTIES","paragraphs":["1. Plaintiff [PLAINTIFF] is an individual residing in..."],"sourceChunkIds":[1,2]}]`,
      },
    ],
    8192
  );

  let sections: Array<{
    heading: string;
    paragraphs: string[];
    sourceChunkIds: number[];
  }>;
  try {
    sections = extractJson(rawText) as typeof sections;
  } catch (err) {
    console.error("[generateComplaint] JSON extraction failed:", err);
    throw new Error("Could not parse model response as JSON. Check server logs.");
  }

  const resolvedSections: ComplaintSection[] = sections.map((s) => ({
    heading: s.heading,
    paragraphs: s.paragraphs,
    sourceChunkIds: s.sourceChunkIds
      .map((n) => indexToId.get(n))
      .filter((id): id is string => !!id),
  }));

  const artifact = await prisma.generatedArtifact.create({
    data: {
      matterId,
      type: ArtifactType.COMPLAINT_SKELETON,
      content: resolvedSections as any,
    },
  });

  const allChunkIds = Array.from(
    new Set(resolvedSections.flatMap((s) => s.sourceChunkIds))
  );
  await saveCitations(artifact.id, allChunkIds);

  return { artifactId: artifact.id, sections: resolvedSections };
}
