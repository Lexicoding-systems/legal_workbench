import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveUploadedFile } from "@/modules/documents/upload.service";
import { createDocument } from "@/modules/documents/documents.service";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const matterId = formData.get("matterId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!matterId) {
      return NextResponse.json({ error: "matterId is required" }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType}. Allowed: PDF, plain text, markdown.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = await saveUploadedFile(matterId, file.name, buffer);

    const document = await createDocument({
      matterId,
      filename: file.name,
      mimeType,
      filePath,
    });

    return NextResponse.json(document, { status: 201 });
  } catch (err) {
    console.error("[POST /api/documents]", err);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}
