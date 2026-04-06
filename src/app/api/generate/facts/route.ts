import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateFacts } from "@/modules/generation/facts.generator";

const Schema = z.object({ matterId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const result = await generateFacts(parsed.data.matterId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/generate/facts]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
