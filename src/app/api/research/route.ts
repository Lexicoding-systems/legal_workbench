import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryPerplexity } from "@/lib/perplexity";

const ResearchSchema = z.object({
  query: z.string().min(1).max(1000),
  // Optional: matter context injected into the system prompt
  matterContext: z.string().max(500).optional(),
});

const LEGAL_SYSTEM_PROMPT = `You are a legal research assistant. Provide accurate, sourced answers focused on:
- Relevant case law and precedents
- Applicable statutes and regulations
- Legal standards and tests courts apply
- Jurisdiction-specific rules where relevant

Be precise and cite your sources. Flag when an area of law is unsettled or jurisdiction-dependent.
Do not give legal advice — provide legal information and let the attorney assess applicability.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ResearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { query, matterContext } = parsed.data;

    const systemPrompt = matterContext
      ? `${LEGAL_SYSTEM_PROMPT}\n\nMatter context: ${matterContext}`
      : LEGAL_SYSTEM_PROMPT;

    const result = await queryPerplexity([
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ]);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/research]", err);
    const message = err instanceof Error ? err.message : "Research query failed";
    // Surface API key errors explicitly so user knows what to fix
    const status = message.includes("PERPLEXITY_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
