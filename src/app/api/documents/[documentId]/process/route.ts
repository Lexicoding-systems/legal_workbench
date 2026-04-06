import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDocument, updateDocumentStatus } from "@/modules/documents/documents.service";
import { extractPdfPages, extractTextFile } from "@/modules/parsing/pdf.parser";
import { chunkPages } from "@/modules/parsing/chunker";
import { DocumentStatus } from "@prisma/client";

const TEXT_MIME_TYPES = ["text/plain", "text/markdown", "text/x-markdown"];

export async function POST(
  _req: NextRequest,
  { params }: { params: { documentId: string } }
) {
  const { documentId } = params;

  const document = await getDocument(documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (document.status === DocumentStatus.PROCESSING) {
    return NextResponse.json({ error: "Document is already being processed" }, { status: 409 });
  }

  await updateDocumentStatus(documentId, DocumentStatus.PROCESSING);

  try {
    // Extract text pages from file
    let pages;
    if (TEXT_MIME_TYPES.includes(document.mimeType)) {
      pages = await extractTextFile(document.filePath);
    } else {
      pages = await extractPdfPages(document.filePath);
    }

    if (pages.length === 0) {
      throw new Error("No text could be extracted from the document.");
    }

    // Store DocumentPage records
    await prisma.documentPage.createMany({
      data: pages.map((p) => ({
        documentId,
        pageNumber: p.pageNumber,
        extractedText: p.text,
      })),
    });

    // Chunk all pages and store Chunk records
    const rawChunks = chunkPages(pages, documentId, document.filename);
    await prisma.chunk.createMany({
      data: rawChunks,
    });

    await updateDocumentStatus(documentId, DocumentStatus.READY);

    return NextResponse.json({
      ok: true,
      pageCount: pages.length,
      chunkCount: rawChunks.length,
    });
  } catch (err) {
    console.error("[POST /api/documents/[documentId]/process]", err);
    await updateDocumentStatus(documentId, DocumentStatus.ERROR);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 }
    );
  }
}
