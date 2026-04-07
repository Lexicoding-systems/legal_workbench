import { NextRequest, NextResponse } from "next/server";
import { saveUploadedFile } from "@/modules/documents/upload.service";
import { createDocument } from "@/modules/documents/documents.service";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
];

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

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

    // Reject oversized files before buffering them into memory
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 50 MB.` },
        { status: 413 }
      );
    }

    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType}. Supported: PDF, plain text, markdown.` },
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
