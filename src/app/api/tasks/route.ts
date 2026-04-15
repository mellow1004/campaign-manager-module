import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      campaign_id?: string;
      title: string;
      description?: string;
      due_date: string;
      priority: "high" | "medium" | "low";
      assigned_to_id: string;
    };

    if (!body.title || !body.due_date || !body.priority || !body.assigned_to_id) {
      return NextResponse.json({ error: "Obligatoriska fält saknas" }, { status: 400 });
    }

    // Use first PM as created_by (auth will replace this later)
    const creator = await prisma.user.findFirst({ where: { role: "pm" } });
    if (!creator) return NextResponse.json({ error: "Ingen PM hittades" }, { status: 400 });

    const task = await prisma.task.create({
      data: {
        title:       body.title,
        description: body.description ?? "",
        due_date:    new Date(body.due_date),
        priority:    body.priority,
        status:      "open",
        task_type:   "manual",
        recurrence:  "none",
        assigned_to: { connect: { user_id: body.assigned_to_id } },
        created_by:  { connect: { user_id: creator.user_id } },
        ...(body.campaign_id ? { campaign: { connect: { campaign_id: body.campaign_id } } } : {}),
      },
      include: { assigned_to: { select: { name: true } } },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error("POST /api/tasks", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
