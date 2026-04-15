import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

/** Returns true if `date` is a weekday (Mon–Fri) */
function isWeekday(date: Date): boolean {
  const d = date.getDay();
  return d >= 1 && d <= 5;
}

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek  = today.getDay(); // 0=Sun 1=Mon … 5=Fri
  const dayOfMonth = today.getDate();
  const weekNumber = getIsoWeek(today);
  const year       = today.getFullYear();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const actions: string[] = [];

  // ── Fetch all relevant campaigns ──────────────────────────────────────────
  const campaigns = await prisma.campaign.findMany({
    where: { status: { in: ["active", "closing"] } },
    include: {
      assigned_pm: { select: { user_id: true, name: true } },
      assigned_tl: { select: { user_id: true, name: true } },
      activity_logs: {
        where: { date: { gte: monthStart, lte: today } },
        orderBy: { date: "desc" },
        select: { date: true, meetings_booked: true },
      },
      tasks: {
        where: { status: { in: ["open", "in_progress"] } },
        select: { task_id: true, priority: true, due_date: true, title: true },
      },
      weekly_reports: {
        where: { week_number: weekNumber, year },
        select: { status: true },
      },
      checklist_instances: {
        where: { week_number: weekNumber, year },
        include: { template: { select: { type: true } } },
      },
    },
  });

  // ── MONDAY: Report tasks + weekly checklists ──────────────────────────────
  if (dayOfWeek === 1) {
    const weeklyTemplate = await prisma.checklistTemplate.findFirst({
      where: { type: "weekly" },
    });
    const tuesday = new Date(today);
    tuesday.setDate(tuesday.getDate() + 1);

    for (const c of campaigns) {
      if (c.status !== "active") continue;

      // Create "Skicka veckorapport" task if not already exists this week
      const hasReportTask = c.tasks.some((t) =>
        t.title.includes(`v.${weekNumber}`) && t.title.includes("veckorapport")
      );
      if (!hasReportTask) {
        await prisma.task.create({
          data: {
            campaign:    { connect: { campaign_id: c.campaign_id } },
            assigned_to: { connect: { user_id: c.assigned_pm.user_id } },
            created_by:  { connect: { user_id: c.assigned_pm.user_id } },
            title:       `Skicka veckorapport v.${weekNumber} – ${c.client_name}`,
            description: `Veckorapporten ska skickas senast tisdag EOD.`,
            due_date:    tuesday,
            priority:    "high",
            status:      "open",
            task_type:   "auto_generated",
            recurrence:  "weekly",
          },
        });
        actions.push(`[MÅN] Rapport-task skapad: ${c.client_name}`);
      }

      // Create weekly checklist if not already exists this week
      const hasWeeklyChecklist = c.checklist_instances.some(
        (i) => i.template.type === "weekly"
      );
      if (!hasWeeklyChecklist && weeklyTemplate) {
        const templateItems = weeklyTemplate.items as Array<{
          order: number; title: string; description?: string; is_blocking?: boolean;
        }>;
        await prisma.checklistInstance.create({
          data: {
            campaign: { connect: { campaign_id: c.campaign_id } },
            template: { connect: { template_id: weeklyTemplate.template_id } },
            week_number: weekNumber,
            year,
            items: templateItems.map((item) => ({
              ...item,
              completed: false,
              completed_at: null,
            })),
            completion_pct: 0,
          },
        });
        actions.push(`[MÅN] Veckochecklista skapad: ${c.client_name}`);
      }
    }
  }

  // ── FRIDAY: Påminnelse om osänd rapport ──────────────────────────────────
  if (dayOfWeek === 5) {
    for (const c of campaigns) {
      if (c.status !== "active") continue;
      const reportSent = c.weekly_reports.some((r) => r.status === "sent");
      if (!reportSent) {
        const alreadyReminded = c.tasks.some(
          (t) => t.title.includes("Påminnelse") && t.title.includes(`v.${weekNumber}`)
        );
        if (!alreadyReminded) {
          await prisma.task.create({
            data: {
              campaign:    { connect: { campaign_id: c.campaign_id } },
              assigned_to: { connect: { user_id: c.assigned_pm.user_id } },
              created_by:  { connect: { user_id: c.assigned_pm.user_id } },
              title:       `Påminnelse: Veckorapport v.${weekNumber} ej skickad – ${c.client_name}`,
              description: `Rapporten måste skickas idag (fredag) eller senast tisdag EOD.`,
              due_date:    today,
              priority:    "high",
              status:      "open",
              task_type:   "auto_generated",
              recurrence:  "none",
            },
          });
          actions.push(`[FRE] Rapport-påminnelse: ${c.client_name}`);
        }
      }
    }
  }

  // ── DAG 15: Flagga röd om MTD < 50 % av mål ─────────────────────────────
  if (dayOfMonth === 15) {
    for (const c of campaigns) {
      if (c.status !== "active") continue;
      const meetingsMtd = c.activity_logs.reduce((s, l) => s + l.meetings_booked, 0);
      const halfTarget  = Math.round(c.monthly_meeting_target * 0.5);
      if (meetingsMtd < halfTarget && c.health_score >= 40) {
        await prisma.campaign.update({
          where: { campaign_id: c.campaign_id },
          data:  { health_score: 35 },
        });
        actions.push(`[D15] Röd-flaggad: ${c.client_name} (${meetingsMtd}/${halfTarget} möten)`);
      }
    }
  }

  // ── DAGLIG: Eskalera hög-prio tasks försenade > 2 dagar till TL ─────────
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  for (const c of campaigns) {
    const overdue = c.tasks.filter(
      (t) => t.priority === "high" && new Date(t.due_date) < twoDaysAgo
    );
    if (overdue.length === 0) continue;

    const alreadyEscalated = c.tasks.some(
      (t) =>
        t.title.startsWith("Eskalering:") &&
        new Date(t.due_date) >= twoDaysAgo
    );
    if (!alreadyEscalated) {
      await prisma.task.create({
        data: {
          campaign:    { connect: { campaign_id: c.campaign_id } },
          assigned_to: { connect: { user_id: c.assigned_tl.user_id } },
          created_by:  { connect: { user_id: c.assigned_pm.user_id } },
          title:       `Eskalering: ${overdue.length} försenade hög-prio tasks – ${c.client_name}`,
          description: `${overdue.length} hög-prioritet tasks är försenade >2 dagar. Kräver TL-åtgärd.`,
          due_date:    today,
          priority:    "high",
          status:      "open",
          task_type:   "auto_generated",
          recurrence:  "none",
        },
      });
      actions.push(`[DAGLIG] Eskalering: ${c.client_name} (${overdue.length} tasks)`);
    }
  }

  // ── DAGLIG: Aktivitetsgap – 0 loggar 2+ vardagar i rad ──────────────────
  for (const c of campaigns) {
    if (c.status !== "active") continue;

    // Check last 3 weekdays for missing logs
    const missingDays: Date[] = [];
    for (let i = 1; i <= 5; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (!isWeekday(d)) continue;
      const hasLog = c.activity_logs.some(
        (l) => new Date(l.date).toDateString() === d.toDateString()
      );
      if (!hasLog) missingDays.push(d);
      if (missingDays.length >= 2) break;
    }

    if (missingDays.length >= 2) {
      // Reduce health score by 10 if not already red (once per gap detection)
      if (c.health_score > 40) {
        await prisma.campaign.update({
          where: { campaign_id: c.campaign_id },
          data:  { health_score: Math.max(c.health_score - 10, 30) },
        });
        actions.push(`[DAGLIG] Aktivitetsgap: ${c.client_name} (-10 hälsopoäng)`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt:   today.toISOString(),
    weekDay: dayOfWeek,
    actions,
  });
}
