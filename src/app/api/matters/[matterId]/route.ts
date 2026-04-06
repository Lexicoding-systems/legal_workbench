import { NextRequest, NextResponse } from "next/server";
import { getMatter, deleteMatter } from "@/modules/matters/matters.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: { matterId: string } }
) {
  try {
    const matter = await getMatter(params.matterId);
    if (!matter) {
      return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    }
    return NextResponse.json(matter);
  } catch (err) {
    console.error("[GET /api/matters/[matterId]]", err);
    return NextResponse.json({ error: "Failed to get matter" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { matterId: string } }
) {
  try {
    await deleteMatter(params.matterId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/matters/[matterId]]", err);
    return NextResponse.json({ error: "Failed to delete matter" }, { status: 500 });
  }
}
