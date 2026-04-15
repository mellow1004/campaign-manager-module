import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      status?: "open" | "in_progress" | "done";
      priority?: "high" | "medium" | "low";
      title?: string;
      description?: string;
      due_date?: string;
    };

    const task = await prisma.task.update({
      where: { task_id: id },
      data: {
        ...(body.status !== undefined && {
          status:       body.status,
          completed_at: body.status === "done" ? new Date() : null,
        }),
        ...(body.priority    !== undefined && { priority:    body.priority }),
        ...(body.title       !== undefined && { title:       body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.due_date    !== undefined && { due_date:    new Date(body.due_date) }),
      },
      include: { assigned_to: { select: { name: true } } },
    });

    return NextResponse.json(task);
  } catch (err) {
    console.error("PATCH /api/tasks/[id]", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.task.delete({ where: { task_id: id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tasks/[id]", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
