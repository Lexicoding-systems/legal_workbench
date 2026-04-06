import { prisma } from "@/lib/prisma";

export async function createMatter(data: {
  name: string;
  description?: string;
}) {
  return prisma.matter.create({ data });
}

export async function listMatters() {
  return prisma.matter.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { documents: true, artifacts: true } },
    },
  });
}

export async function getMatter(id: string) {
  return prisma.matter.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      artifacts: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function deleteMatter(id: string) {
  return prisma.matter.delete({ where: { id } });
}
