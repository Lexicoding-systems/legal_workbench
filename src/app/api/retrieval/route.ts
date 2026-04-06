import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { retrieveChunks } from "@/modules/retrieval/retrieval.service";

const RetrievalSchema = z.object({
  query: z.string().min(1),
  matterId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RetrievalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { query, matterId, limit } = parsed.data;
    const chunks = await retrieveChunks(query, matterId, limit);
    return NextResponse.json({ chunks, count: chunks.length });
  } catch (err) {
    console.error("[POST /api/retrieval]", err);
    return NextResponse.json({ error: "Retrieval failed" }, { status: 500 });
  }
}
