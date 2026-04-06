import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createMatter, listMatters } from "@/modules/matters/matters.service";

const CreateMatterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export async function GET() {
  try {
    const matters = await listMatters();
    return NextResponse.json(matters);
  } catch (err) {
    console.error("[GET /api/matters]", err);
    return NextResponse.json({ error: "Failed to list matters" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateMatterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const matter = await createMatter(parsed.data);
    return NextResponse.json(matter, { status: 201 });
  } catch (err) {
    console.error("[POST /api/matters]", err);
    return NextResponse.json({ error: "Failed to create matter" }, { status: 500 });
  }
}
