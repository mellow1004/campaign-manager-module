import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface ChecklistItem {
  order: number;
  title: string;
  description?: string;
  is_blocking?: boolean;
  completed: boolean;
  completed_at: string | null;
}

interface Params { params: Promise<{ id: string }> }

// PATCH: toggle a single item's completed state
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { itemOrder, completed } = await req.json() as {
      itemOrder: number;
      completed: boolean;
    };

    const instance = await prisma.checklistInstance.findUnique({
      where: { instance_id: id },
    });
    if (!instance) return NextResponse.json({ error: "Inte hittad" }, { status: 404 });

    const items = (instance.items as unknown) as ChecklistItem[];
    const updated = items.map((item) =>
      item.order === itemOrder
        ? { ...item, completed, completed_at: completed ? new Date().toISOString() : null }
        : item
    );

    const completedCount = updated.filter((i) => i.completed).length;
    const completion_pct = Math.round((completedCount / updated.length) * 100);

    const result = await prisma.checklistInstance.update({
      where: { instance_id: id },
      data: { items: updated as unknown as import("@prisma/client").Prisma.InputJsonValue, completion_pct },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("PATCH /api/checklists/[id]", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
