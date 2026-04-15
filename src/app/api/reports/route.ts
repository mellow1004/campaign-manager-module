import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      campaign_id: string;
      sent_by_id: string;
      week_number: number;
      year: number;
      meetings_week: number;
      meetings_mtd: number;
      meetings_total: number;
      ai_commentary: string;
      pm_commentary: string;
      next_week_focus: string;
      activity_summary: object;
      recipients: string[];
      status: "draft" | "sent";
    };

    const report = await prisma.weeklyReport.create({
      data: {
        campaign:       { connect: { campaign_id: body.campaign_id } },
        sent_by:        { connect: { user_id: body.sent_by_id } },
        week_number:    body.week_number,
        year:           body.year,
        status:         body.status ?? "draft",
        meetings_week:  body.meetings_week,
        meetings_mtd:   body.meetings_mtd,
        meetings_total: body.meetings_total,
        ai_commentary:  body.ai_commentary ?? "",
        pm_commentary:  body.pm_commentary ?? "",
        next_week_focus: body.next_week_focus ?? "",
        activity_summary: body.activity_summary ?? {},
        recipients:     body.recipients ?? [],
        sent_at:        body.status === "sent" ? new Date() : null,
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (err) {
    console.error("POST /api/reports", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
