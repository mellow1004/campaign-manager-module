import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      ai_commentary?: string;
      pm_commentary?: string;
      next_week_focus?: string;
      status?: "draft" | "sent";
      sent_at?: string | null;
    };

    const updateData: {
      ai_commentary?: string;
      pm_commentary?: string;
      next_week_focus?: string;
      status?: "draft" | "sent";
      sent_at?: Date | null;
    } = {};

    if (typeof body.ai_commentary === "string") updateData.ai_commentary = body.ai_commentary;
    if (typeof body.pm_commentary === "string") updateData.pm_commentary = body.pm_commentary;
    if (typeof body.next_week_focus === "string") updateData.next_week_focus = body.next_week_focus;
    if (body.status === "draft" || body.status === "sent") updateData.status = body.status;
    if (typeof body.sent_at === "string") updateData.sent_at = new Date(body.sent_at);
    if (body.sent_at === null) updateData.sent_at = null;

    const report = await prisma.weeklyReport.update({
      where: { report_id: id },
      data: updateData,
    });

    return NextResponse.json(report);
  } catch (err) {
    console.error("PATCH /api/reports/[id]", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
