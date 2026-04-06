import { prisma } from "@/lib/prisma";
import { DocumentStatus } from "@prisma/client";

export async function createDocument(data: {
  matterId: string;
  filename: string;
  mimeType: string;
  filePath: string;
}) {
  return prisma.document.create({ data });
}

export async function getDocument(id: string) {
  return prisma.document.findUnique({ where: { id } });
}

export async function getDocumentsByMatter(matterId: string) {
  return prisma.document.findMany({
    where: { matterId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateDocumentStatus(id: string, status: DocumentStatus) {
  return prisma.document.update({ where: { id }, data: { status } });
}
