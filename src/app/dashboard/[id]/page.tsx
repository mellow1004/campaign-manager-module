import { CampaignStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";

type TabId = "oversikt" | "aktivitet" | "icp" | "tasks" | "checklistor" | "rapporter";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "oversikt", label: "Översikt" },
  { id: "aktivitet", label: "Aktivitet" },
  { id: "icp", label: "ICP" },
  { id: "tasks", label: "Tasks" },
  { id: "checklistor", label: "Checklistor" },
  { id: "rapporter", label: "Rapporter" },
];

const STATUS_LABELS: Record<CampaignStatus, string> = {
  onboarding: "Onboarding",
  active: "Aktiv",
  paused: "Pausad",
  closing: "Avslutar",
  closed: "Avslutad",
};

function getStartOfWeek(date: Date): Date {
  const copy = new Date(date);
  const weekday = copy.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDaysUntilNextTuesday(date: Date): number {
  const weekday = date.getDay();
  const targetWeekday = 2;
  return (targetWeekday - weekday + 7) % 7;
}

function statusClass(status: CampaignStatus): string {
  switch (status) {
    case "active":
      return "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]";
    case "paused":
      return "bg-zinc-100 text-zinc-700";
    case "onboarding":
      return "bg-sky-100 text-sky-800";
    case "closing":
      return "bg-amber-100 text-amber-800";
    case "closed":
      return "bg-zinc-100 text-zinc-600";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function renderPlaceholder(tab: TabId): JSX.Element {
  const labels: Record<TabId, string> = {
    oversikt: "Översikt",
    aktivitet: "Aktivitet",
    icp: "ICP",
    tasks: "Tasks",
    checklistor: "Checklistor",
    rapporter: "Rapporter",
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-zinc-900">{labels[tab]}</h3>
      <p className="mt-2 text-sm text-zinc-600">
        Innehåll för fliken kommer i nästa steg enligt PRD.
      </p>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function CampaignDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedTab = resolvedSearchParams?.tab;
  const activeTab: TabId = TABS.some((tab) => tab.id === requestedTab)
    ? (requestedTab as TabId)
    : "oversikt";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = getStartOfWeek(today);
  const monthStart = getStartOfMonth(today);
  const reportDaysLeft = getDaysUntilNextTuesday(today);

  const campaign = await prisma.campaign.findUnique({
    where: { campaign_id: id },
    include: {
      assigned_pm: {
        select: { name: true, avatar_initials: true },
      },
      assigned_tl: {
        select: { name: true },
      },
      activity_logs: {
        where: { date: { gte: monthStart, lte: today } },
        orderBy: { date: "desc" },
        select: {
          date: true,
          meetings_booked: true,
          dials: true,
          emails_sent: true,
          linkedin_accepted: true,
          linkedin_requests: true,
        },
      },
      tasks: {
        where: { status: { in: ["open", "in_progress"] } },
        orderBy: [{ due_date: "asc" }, { created_at: "desc" }],
        take: 5,
        include: {
          assigned_to: { select: { name: true } },
        },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const meetingsWeek = campaign.activity_logs
    .filter((log) => log.date >= weekStart)
    .reduce((sum, log) => sum + log.meetings_booked, 0);
  const meetingsMtd = campaign.activity_logs.reduce((sum, log) => sum + log.meetings_booked, 0);
  const meetingsTotal = campaign.meetings_booked_mtd;
  const liAccepted = campaign.activity_logs.reduce((sum, log) => sum + log.linkedin_accepted, 0);
  const liRequests = campaign.activity_logs.reduce((sum, log) => sum + log.linkedin_requests, 0);
  const liAcceptRate = liRequests > 0 ? Math.round((liAccepted / liRequests) * 100) : 0;

  return (
    <div className="flex min-h-screen overflow-hidden bg-[#F4F4F5] text-zinc-900">
      <aside className="hidden w-[200px] shrink-0 flex-col bg-[#18181B] md:flex">
        <div className="border-b border-white/10 px-4 pt-[18px] pb-3">
          <p className="text-[15px] font-medium text-white">Otto</p>
          <p className="mt-0.5 text-[10px] text-white/35">CoSeller Suite</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3 text-[12px]">
          <Link href="/dashboard" className="flex items-center gap-2 rounded-md px-[10px] py-2 text-white/50">
            ▦ Dashboard
          </Link>
          <div className="flex items-center gap-2 rounded-md bg-[rgba(29,158,117,0.2)] px-[10px] py-2 text-[#3ECFA0]">
            ◈ Kampanjer
            <span className="ml-auto rounded-full bg-[rgba(226,75,74,0.25)] px-1.5 py-0.5 text-[10px] text-[#F09595]">
              12
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md px-[10px] py-2 text-white/50">
            ✓ Mina todos
            <span className="ml-auto rounded-full bg-[rgba(226,75,74,0.25)] px-1.5 py-0.5 text-[10px] text-[#F09595]">
              5
            </span>
          </div>
          <div className="rounded-md px-[10px] py-2 text-white/50">↗ Rapporter</div>
          <div className="rounded-md px-[10px] py-2 text-white/50">≡ Checklistor</div>
        </nav>
        <div className="flex items-center gap-2 border-t border-white/10 px-3.5 py-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1D9E75] text-[10px] font-medium text-white">
            {campaign.assigned_pm.avatar_initials}
          </div>
          <div>
            <p className="text-[11px] text-white/70">{campaign.assigned_pm.name}</p>
            <p className="text-[10px] text-white/35">Project Manager</p>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h1 className="text-[14px] font-semibold text-[#18181B]">{campaign.client_name}</h1>
                <Badge className={statusClass(campaign.status)}>{STATUS_LABELS[campaign.status]}</Badge>
              </div>
              <p className="text-[11px] text-zinc-500">
                Rapport deadline:{" "}
                <span className="font-medium text-[#EF9F27]">
                  {reportDaysLeft === 0 ? "idag" : `${reportDaysLeft} dagar`}
                </span>
              </p>
            </div>
            <div className="mt-1.5 grid grid-cols-2 rounded-md border border-zinc-200 bg-zinc-50 md:grid-cols-5">
              <div className="border-r border-b border-zinc-200 px-2 py-1 md:border-b-0">
                <p className="text-[10px] text-zinc-500">Möten totalt</p>
                <p className="text-[16px] leading-5 font-semibold">{meetingsTotal}</p>
              </div>
              <div className="border-b border-zinc-200 px-2 py-1 md:border-r md:border-b-0">
                <p className="text-[10px] text-zinc-500">MTD</p>
                <p className="text-[16px] leading-5 font-semibold">{meetingsMtd}</p>
              </div>
              <div className="border-r border-zinc-200 px-2 py-1 md:border-r">
                <p className="text-[10px] text-zinc-500">Veckan</p>
                <p className="text-[16px] leading-5 font-semibold">{meetingsWeek}</p>
              </div>
              <div className="px-2 py-1 md:border-r md:border-zinc-200">
                <p className="text-[10px] text-zinc-500">Rapport deadline</p>
                <p className="text-[12px] leading-5 font-semibold">Tisdag EOD</p>
              </div>
              <div className="col-span-2 border-t border-zinc-200 px-2 py-1 md:col-span-1 md:border-t-0">
                <p className="text-[10px] text-zinc-500">LI-accept-rate</p>
                <p className="text-[16px] leading-5 font-semibold">{liAcceptRate}%</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 px-4 py-1.5">
            {TABS.map((tab) => (
              <Link
                key={tab.id}
                href={`/dashboard/${campaign.campaign_id}?tab=${tab.id}`}
                className={`rounded-md px-2.5 py-1 text-[11px] ${
                  activeTab === tab.id
                    ? "bg-[rgba(29,158,117,0.12)] text-[#0F6E56]"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        <section className="flex-1 overflow-y-auto p-2.5">
          {activeTab === "oversikt" ? (
            <div className="space-y-2">
              <div className="px-0.5 py-1">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] md:grid-cols-5">
                  <p><span className="text-zinc-500">PM</span> <span className="font-medium">{campaign.assigned_pm.name}</span></p>
                  <p><span className="text-zinc-500">TL</span> <span className="font-medium">{campaign.assigned_tl.name}</span></p>
                  <p><span className="text-zinc-500">Start</span> <span className="font-medium">{formatDate(campaign.start_date)}</span></p>
                  <p><span className="text-zinc-500">Slut</span> <span className="font-medium">{formatDate(campaign.end_date)}</span></p>
                  <p><span className="text-zinc-500">Kontrakt</span> <span className="font-medium capitalize">{campaign.contract_type}</span></p>
                </div>
              </div>

              <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-2">
                <h2 className="text-[12px] font-semibold">KPI-sammanfattning</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px]">
                  <p><span className="text-zinc-500">Vecka</span> <span className="font-semibold">{meetingsWeek}</span> / {campaign.weekly_meeting_target}</p>
                  <p><span className="text-zinc-500">MTD</span> <span className="font-semibold">{meetingsMtd}</span> / {campaign.monthly_meeting_target}</p>
                  <p><span className="text-zinc-500">Hälsoindex</span> <span className="font-semibold">{campaign.health_score}</span></p>
                  <p><span className="text-zinc-500">Nästa rapport</span> <span className="font-semibold">Tisdag EOD</span></p>
                </div>
              </div>

              <div className="px-0.5 py-1">
                <h2 className="text-[12px] font-semibold">Öppna tasks (top 5)</h2>
                {campaign.tasks.length === 0 ? (
                  <p className="mt-1 text-[11px] text-zinc-500">Inga öppna tasks för kampanjen.</p>
                ) : (
                  <div className="mt-1 overflow-hidden rounded-sm border border-zinc-200">
                    {campaign.tasks.map((task, taskIndex) => (
                      <div
                        key={task.task_id}
                        className={`grid grid-cols-[1fr_auto] items-center gap-2 px-1 py-1.5 ${
                          taskIndex % 2 === 0 ? "bg-zinc-50" : "bg-white"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-zinc-900">{task.title}</p>
                          <p className="truncate text-[10px] text-zinc-500">
                            Tilldelad: {task.assigned_to.name} · Förfall: {formatDate(task.due_date)}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            `text-[10px] ${task.priority === "high"
                              ? "bg-rose-100 text-rose-700"
                              : task.priority === "medium"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-zinc-200 text-zinc-700"}`
                          }
                        >
                          {task.priority === "high"
                            ? "Hög"
                            : task.priority === "medium"
                              ? "Medium"
                              : "Låg"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            renderPlaceholder(activeTab)
          )}
        </section>
      </main>
    </div>
  );
}
