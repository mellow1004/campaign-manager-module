import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      campaign_id: string;
      date: string;
      dials: number;
      connects: number;
      emails_sent: number;
      replies: number;
      linkedin_requests: number;
      linkedin_accepted: number;
      meetings_booked: number;
    };

    const logger = await prisma.user.findFirst({ where: { role: "pm" } });
    if (!logger) return NextResponse.json({ error: "Ingen PM" }, { status: 400 });

    const date = new Date(body.date);
    date.setHours(0, 0, 0, 0);

    // Upsert: update if exists for that date, otherwise create
    const existing = await prisma.activityLog.findFirst({
      where: { campaign_id: body.campaign_id, date },
    });

    let log;
    if (existing) {
      log = await prisma.activityLog.update({
        where: { log_id: existing.log_id },
        data: {
          dials:              body.dials,
          connects:           body.connects,
          emails_sent:        body.emails_sent,
          replies:            body.replies,
          linkedin_requests:  body.linkedin_requests,
          linkedin_accepted:  body.linkedin_accepted,
          meetings_booked:    body.meetings_booked,
        },
      });
    } else {
      log = await prisma.activityLog.create({
        data: {
          campaign:         { connect: { campaign_id: body.campaign_id } },
          logged_by:        { connect: { user_id: logger.user_id } },
          date,
          dials:            body.dials,
          connects:         body.connects,
          emails_sent:      body.emails_sent,
          replies:          body.replies,
          linkedin_requests: body.linkedin_requests,
          linkedin_accepted: body.linkedin_accepted,
          meetings_booked:  body.meetings_booked,
        },
      });
    }

    return NextResponse.json(log, { status: existing ? 200 : 201 });
  } catch (err) {
    console.error("POST /api/activity", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
