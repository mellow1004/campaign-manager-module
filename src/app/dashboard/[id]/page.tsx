import { CampaignStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TasksTab from "@/components/TasksTab";
import ChecklistsTab from "@/components/ChecklistsTab";
import ClientActivityTab from "@/components/ClientActivityTab";
import ReportsTab from "@/components/ReportsTab";
import ActivityChart from "@/components/ActivityChart";

type TabId = "oversikt" | "aktivitet" | "icp" | "tasks" | "checklistor" | "rapporter";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "oversikt",    label: "Översikt" },
  { id: "aktivitet",  label: "Aktivitet & pipeline" },
  { id: "icp",        label: "ICP / målgrupp" },
  { id: "tasks",      label: "Tasks" },
  { id: "checklistor",label: "Checklistor" },
  { id: "rapporter",  label: "Rapporter" },
];

const STATUS_LABELS: Record<CampaignStatus, string> = {
  onboarding: "Onboarding",
  active: "Aktiv",
  paused: "Pausad",
  closing: "Avslutar",
  closed: "Avslutad",
};

const CHANNEL_SV: Record<string, string> = {
  phone: "Telefon",
  email: "Email",
  linkedin: "LinkedIn",
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

/** Tisdag = rapportdag → 0 (visa "idag"), i linje med mockup 02. */
function daysToTuesday(date: Date): number {
  return (2 - date.getDay() + 7) % 7;
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function CampaignDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const activeTab: TabId = TABS.some((t) => t.id === sp?.tab) ? (sp!.tab as TabId) : "oversikt";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = getWeekStart(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const campaign = await prisma.campaign.findUnique({
    where: { campaign_id: id },
    include: {
      assigned_pm: { select: { name: true, avatar_initials: true } },
      assigned_tl:  { select: { name: true } },
      activity_logs: {
        where: { date: { gte: threeMonthsAgo, lte: today } },
        orderBy: { date: "desc" },
      },
      tasks: {
        orderBy: [{ due_date: "asc" }, { created_at: "desc" }],
        include: { assigned_to: { select: { name: true } } },
      },
      icps: {
        orderBy: { version: "desc" },
      },
      weekly_reports: {
        orderBy: [{ year: "desc" }, { week_number: "desc" }],
      },
      checklist_instances: {
        include: { template: { select: { type: true, name: true } } },
        orderBy: { created_at: "desc" },
      },
    },
  });

  if (!campaign) notFound();

  const [openTodoCount, campaignListCount] = await Promise.all([
    prisma.task.count({ where: { status: { in: ["open", "in_progress"] } } }),
    prisma.campaign.count(),
  ]);

  const meetingsWeek = campaign.activity_logs
    .filter((l) => l.date >= weekStart)
    .reduce((s, l) => s + l.meetings_booked, 0);
  const meetingsMtd = campaign.activity_logs
    .filter((l) => l.date >= monthStart)
    .reduce((s, l) => s + l.meetings_booked, 0);
  const liAccepted = campaign.activity_logs.reduce((s, l) => s + l.linkedin_accepted, 0);
  const liRequests = campaign.activity_logs.reduce((s, l) => s + l.linkedin_requests, 0);
  const liAcceptRate = liRequests > 0 ? Math.round((liAccepted / liRequests) * 100) : 0;
  const liBenchmark = 28;
  const liVsBenchmark = liAcceptRate - liBenchmark;
  const liVsBenchmarkText = `${liVsBenchmark >= 0 ? "+" : ""}${liVsBenchmark}% vs sn.`;
  const meetingsBookedTotal = campaign.activity_logs.reduce((s, l) => s + l.meetings_booked, 0);
  const roughTotalTarget = campaign.monthly_meeting_target * 6;
  const sdrNames = ((campaign as unknown as { sdr_names?: string[] }).sdr_names ?? []).filter((name) => name.length > 0);

  const reportDaysLeft = daysToTuesday(today);
  const activeIcp = campaign.icps.find((i) => i.status === "active") ?? campaign.icps[0] ?? null;

  // Taktindikator: compare MTD meetings against prorated monthly target
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const proratedTarget = Math.round((campaign.monthly_meeting_target * dayOfMonth) / daysInMonth);
  const pace: "on_track" | "behind" | "ahead" =
    meetingsMtd >= proratedTarget * 1.1 ? "ahead" :
    meetingsMtd >= proratedTarget * 0.85 ? "on_track" : "behind";

  const chartWindowStart = new Date(today);
  chartWindowStart.setDate(chartWindowStart.getDate() - 27);
  const activityLogsForChart = campaign.activity_logs
    .filter((l) => l.date >= chartWindowStart && l.date <= today)
    .map((l) => ({
      date: l.date.toISOString().split("T")[0] ?? "",
      dials: l.dials,
      connects: l.connects,
      emails_sent: l.emails_sent,
      meetings_booked: l.meetings_booked,
    }));

  const activityTableLogs = campaign.activity_logs.map((l) => ({
    log_id: l.log_id,
    date: l.date.toISOString().split("T")[0] ?? "",
    dials: l.dials,
    connects: l.connects,
    emails_sent: l.emails_sent,
    replies: l.replies,
    linkedin_requests: l.linkedin_requests,
    linkedin_accepted: l.linkedin_accepted,
    meetings_booked: l.meetings_booked,
  }));

  // ISO week number for today
  function getIsoWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
  }
  const currentWeekNumber = getIsoWeek(today);
  const currentYear = today.getFullYear();

  // This week's activity for report generation
  const thisWeekActivity = {
    dials:              campaign.activity_logs.filter(l => l.date >= weekStart).reduce((s, l) => s + l.dials, 0),
    connects:           campaign.activity_logs.filter(l => l.date >= weekStart).reduce((s, l) => s + l.connects, 0),
    emails_sent:        campaign.activity_logs.filter(l => l.date >= weekStart).reduce((s, l) => s + l.emails_sent, 0),
    replies:            campaign.activity_logs.filter(l => l.date >= weekStart).reduce((s, l) => s + l.replies, 0),
    linkedin_requests:  campaign.activity_logs.filter(l => l.date >= weekStart).reduce((s, l) => s + l.linkedin_requests, 0),
    linkedin_accepted:  campaign.activity_logs.filter(l => l.date >= weekStart).reduce((s, l) => s + l.linkedin_accepted, 0),
  };

  const openTasks = campaign.tasks.filter((t) => t.status === "open" || t.status === "in_progress");
  const openTasksTop = openTasks.slice(0, 4);

  type ChecklistItem = {
    order: number;
    title: string;
    completed?: boolean;
  };
  const weeklyChecklist = campaign.checklist_instances.find((inst) => inst.template.type === "weekly");
  const weeklyChecklistItems = ((weeklyChecklist?.items as ChecklistItem[] | undefined) ?? []).slice(0, 7);
  const checklistDone = weeklyChecklistItems.filter((i) => i.completed).length;
  const checklistTotal = weeklyChecklistItems.length;
  const checklistCompletionPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  function dueLabel(date: Date): { text: string; cls: string } {
    const due = new Date(date);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return { text: "Försenad", cls: "text-[#A32D2D]" };
    if (diffDays === 0) return { text: "Idag", cls: "text-[#854F0B]" };
    if (diffDays === 1) return { text: "Imorgon", cls: "text-[#854F0B]" };
    const dayNames = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
    return { text: dayNames[due.getDay()] ?? "—", cls: "text-[#71717A]" };
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F4F5] text-zinc-900" style={{ fontSize: 13 }}>

      {/* SIDEBAR */}
      <aside className="flex w-[200px] min-w-[200px] shrink-0 flex-col bg-[#18181B]">
        <div className="border-b border-white/[0.07] px-4 pb-3 pt-[18px]">
          <p className="text-[11px] font-medium leading-tight text-white">Project Management -</p>
          <p className="mt-[1px] text-[10px] leading-tight text-white/35">Outbound</p>
        </div>
        <nav className="flex-1 space-y-[2px] px-2 py-[12px]">
          {[
            { label: "▦ Dashboard", href: "/dashboard", active: false, badge: null as number | null },
            { label: "◈ Kampanjer", href: "/dashboard", active: true, badge: campaignListCount },
            { label: "✓ Mina todos", href: "/todos", active: false, badge: openTodoCount },
            { label: "↗ Rapporter", href: "#", active: false, badge: null },
            { label: "≡ Checklistor", href: "#", active: false, badge: null },
            { label: "⚙ ICP-bibliotek", href: "#", active: false, badge: null },
          ].map(({ label, href, active, badge }) => (
            <Link key={label} href={href}
              className={`flex items-center gap-2 rounded-[6px] px-[10px] py-2 text-[12px] leading-tight ${active ? "bg-[rgba(29,158,117,0.2)] text-[#3ECFA0]" : "text-white/45 hover:text-white/70"}`}>
              {label}
              {badge !== null && (
                <span className="ml-auto rounded-[10px] bg-[rgba(226,75,74,0.25)] px-[6px] py-[1px] text-[10px] text-[#F09595]">{badge}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-white/[0.07] px-[14px] py-3">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-[10px] font-medium text-white">
            {campaign.assigned_pm.avatar_initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] text-white/60 leading-tight">{campaign.assigned_pm.name}</p>
            <p className="text-[10px] text-white/30 leading-tight mt-[1px]">Project Manager</p>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex flex-1 flex-col overflow-hidden">

        {/* STICKY HEADER */}
        <div className="shrink-0 border-b border-white/[0.07] bg-[#18181B]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-[20px] py-[11px]">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link href="/dashboard" className="text-[11px] text-white/40 hover:text-white/60">
                ← Alla kampanjer
              </Link>
              <span className="text-white/25">•</span>
              <h1 className="truncate text-[14px] font-medium text-white">{campaign.client_name}</h1>
              <span className="shrink-0 rounded-[10px] bg-[rgba(29,158,117,0.2)] px-[8px] py-[2px] text-[10px] font-medium text-[#3ECFA0]">
                {STATUS_LABELS[campaign.status]}
              </span>
              {sdrNames.length > 0 && (
                <span className="shrink-0 text-[11px] text-white/30">SDR:</span>
              )}
              {sdrNames.map((name) => (
                <span
                  key={name}
                  className="shrink-0 rounded-[10px] bg-white/7 px-[8px] py-[2px] text-[10px] text-white/50"
                >
                  {name}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-[6px]">
              <Link
                href={`/dashboard/${campaign.campaign_id}?tab=aktivitet`}
                className="rounded-[6px] border border-white/15 bg-transparent px-[12px] py-[5px] text-[11px] text-white/60 hover:text-white/75"
              >
                Logga aktivitet
              </Link>
              <Link
                href={`/dashboard/${campaign.campaign_id}?tab=rapporter`}
                className="rounded-[6px] border border-[#185FA5] bg-[#185FA5] px-[12px] py-[5px] text-[11px] text-white hover:bg-[#1D6EBE]"
              >
                Generera rapport
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-5">
            <div className="border-r border-white/[0.07] px-[16px] py-[10px]">
              <p className="text-[9px] uppercase tracking-[0.5px] text-white/40">Möten totalt</p>
              <p className="text-[17px] font-medium leading-tight text-white">{meetingsBookedTotal}</p>
              <p className="text-[10px] text-white/45">av {roughTotalTarget} mål</p>
            </div>
            <div className="border-r border-white/[0.07] px-[16px] py-[10px]">
              <p className="text-[9px] uppercase tracking-[0.5px] text-white/40">MTD</p>
              <p className="text-[17px] font-medium leading-tight text-white">{meetingsMtd}</p>
              <p className="text-[10px] text-white/45">
                av {campaign.monthly_meeting_target} ·{" "}
                <span className={pace === "on_track" ? "text-[#3ECFA0]" : pace === "ahead" ? "text-[#378ADD]" : "text-[#E24B4A]"}>
                  {pace === "on_track" ? "på spår" : pace === "ahead" ? "före" : "bakom"}
                </span>
              </p>
            </div>
            <div className="border-r border-white/[0.07] px-[16px] py-[10px]">
              <p className="text-[9px] uppercase tracking-[0.5px] text-white/40">Veckan</p>
              <p className="text-[17px] font-medium leading-tight text-white">{meetingsWeek}</p>
              <p className="text-[10px] text-white/45">av {campaign.weekly_meeting_target} mål</p>
            </div>
            <div className="border-r border-white/[0.07] px-[16px] py-[10px]">
              <p className="text-[9px] uppercase tracking-[0.5px] text-white/40">LI accept-rate</p>
              <p className="text-[17px] font-medium leading-tight text-white">{liAcceptRate}%</p>
              <p className={`text-[10px] ${liVsBenchmark >= 0 ? "text-[#3ECFA0]" : "text-[#E24B4A]"}`}>{liVsBenchmarkText}</p>
            </div>
            <div className="px-[16px] py-[10px]">
              <p className="text-[9px] uppercase tracking-[0.5px] text-white/40">Rapport</p>
              <p className="text-[14px] font-medium leading-tight text-white">Tisdag</p>
              <p className="text-[10px] text-[#FAC775]">
                {reportDaysLeft === 0
                  ? "idag"
                  : `om ${reportDaysLeft} ${reportDaysLeft === 1 ? "dag" : "dagar"}`}
              </p>
            </div>
          </div>

          <div className="flex items-center border-t border-white/[0.07] border-b border-white/[0.07] px-[20px]">
            {TABS.map((tab) => (
              <Link
                key={tab.id}
                href={`/dashboard/${campaign.campaign_id}?tab=${tab.id}`}
                className={`mb-[-1px] cursor-pointer border-b-2 px-[12px] py-[10px] text-[12px] leading-tight ${
                  activeTab === tab.id
                    ? "border-[#378ADD] text-[#378ADD]"
                    : "border-transparent text-white/40 hover:text-white/60"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        {/* TAB CONTENT */}
        <div className="flex-1 overflow-y-auto bg-[#F4F4F5] px-5 py-[18px]">

          {/* ── ÖVERSIKT ── */}
          {activeTab === "oversikt" && (
            <div className="grid grid-cols-[1fr_300px] gap-[16px]">
              <div>
                <div className="mb-[14px] grid grid-cols-2 gap-[8px]">
                  <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[13px] py-[9px]">
                    <p className="mb-[3px] text-[10px] text-[#71717A]">Period</p>
                    <p className="text-[13px] font-medium text-[#18181B]">
                      {fmtDate(campaign.start_date)} – {fmtDate(campaign.end_date)}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[13px] py-[9px]">
                    <p className="mb-[3px] text-[10px] text-[#71717A]">Marknad</p>
                    <p className="text-[13px] font-medium text-[#18181B]">
                      {campaign.market.replace(/\//g, " · ")}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[13px] py-[9px]">
                    <p className="mb-[3px] text-[10px] text-[#71717A]">Kanaler</p>
                    <p className="text-[13px] font-medium text-[#18181B]">
                      {campaign.channels_enabled.map((ch) => CHANNEL_SV[ch] ?? ch).join(" · ")}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[13px] py-[9px]">
                    <p className="mb-[3px] text-[10px] text-[#71717A]">Kontraktstyp</p>
                    <p className="text-[13px] font-medium capitalize text-[#18181B]">{campaign.contract_type}</p>
                  </div>
                </div>

                <p className="mb-[10px] text-[10px] font-medium uppercase tracking-[0.5px] text-[#71717A]">
                  AKTIVITET SENASTE 4 VECKORNA
                </p>
                <div className="rounded-[8px] border border-[#E4E4E7] bg-white p-[14px]">
                  <ActivityChart logs={activityLogsForChart} />
                </div>
              </div>

              <div className="flex flex-col gap-[13px]">
                <div>
                  <p className="mb-[8px] text-[10px] font-medium uppercase tracking-[0.5px] text-[#71717A]">ÖPPNA TASKS</p>
                  <div className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
                    <div className="flex items-center justify-between border-b border-[#F4F4F5] bg-[#FAFAFA] px-[14px] py-[9px]">
                      <p className="text-[12px] font-medium text-[#18181B]">Tasks ({openTasks.length} öppna)</p>
                      <Link
                        href={`/dashboard/${campaign.campaign_id}?tab=tasks`}
                        className="rounded-[5px] border border-[#E4E4E7] bg-white px-[8px] py-[3px] text-[10px] text-[#71717A]"
                      >
                        + Ny task
                      </Link>
                    </div>
                    {openTasksTop.length === 0 ? (
                      <p className="px-[14px] py-[10px] text-[12px] text-[#71717A]">Inga öppna tasks.</p>
                    ) : (
                      <div>
                        {openTasksTop.map((task) => {
                          const due = dueLabel(task.due_date);
                          const dotCls = task.priority === "high" ? "bg-[#E24B4A]" : task.priority === "medium" ? "bg-[#EF9F27]" : "bg-[#97C459]";
                          return (
                            <div
                              key={task.task_id}
                              className="flex items-center gap-[9px] border-b border-[#F4F4F5] px-[14px] py-[8px] hover:bg-[#FAFAFA]"
                            >
                              <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${dotCls}`} />
                              <span className="h-[14px] w-[14px] shrink-0 rounded-[3px] border border-[#D4D4D8] bg-white" />
                              <p className="min-w-0 flex-1 truncate text-[12px] text-[#18181B]">{task.title}</p>
                              <span className={`shrink-0 text-[10px] ${due.cls}`}>{due.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-[8px] text-[10px] font-medium uppercase tracking-[0.5px] text-[#71717A]">
                    VECKOCHECKLISTA · v.{currentWeekNumber}
                  </p>
                  <div className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
                    <div className="flex items-center gap-[8px] border-b border-[#F4F4F5] bg-[#FAFAFA] px-[14px] py-[8px]">
                      <span className="text-[11px] text-[#71717A]">{checklistDone}/{checklistTotal} klara</span>
                      <div className="h-[4px] flex-1 rounded-[2px] bg-[#E4E4E7]">
                        <div
                          className="h-full rounded-[2px] bg-[#1D9E75]"
                          style={{ width: `${checklistCompletionPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[#71717A]">{checklistCompletionPct}%</span>
                    </div>
                    {weeklyChecklistItems.length === 0 ? (
                      <p className="px-[14px] py-[10px] text-[12px] text-[#71717A]">
                        Ingen veckochecklista tillgänglig.
                      </p>
                    ) : (
                      <div>
                        {weeklyChecklistItems.map((item) => (
                          <div key={`${item.order}-${item.title}`} className="flex items-center gap-[9px] border-b border-[#F4F4F5] px-[14px] py-[7px]">
                            <span
                              className={`flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full border text-[7px] ${
                                item.completed
                                  ? "border-[#1D9E75] bg-[#1D9E75] text-white"
                                  : "border-[#D4D4D8] bg-white text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            <p className={`text-[12px] ${item.completed ? "text-[#A1A1AA] line-through" : "text-[#18181B]"}`}>
                              {item.title}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── AKTIVITET ── */}
          {activeTab === "aktivitet" && (
            <ClientActivityTab
              logs={activityTableLogs}
              clientName={campaign.client_name}
              audiencePoolSize={activeIcp?.estimated_pool_size ?? null}
              sdrNames={sdrNames}
            />
          )}

          {/* ── ICP ── */}
          {activeTab === "icp" && (
            <div className="space-y-3">
              {campaign.icps.length === 0 ? (
                <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-6 text-center text-[12px] text-zinc-400">
                  Ingen ICP-profil för denna kampanj.
                </div>
              ) : (
                <>
                  {/* Version history bar */}
                  {campaign.icps.length > 1 && (
                    <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-[10px]">
                      <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-zinc-400 mb-2">Versionshistorik</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {campaign.icps.map((v) => {
                          const statusCls =
                            v.status === "active"   ? "border-[#1D9E75] bg-[rgba(29,158,117,0.08)] text-[#0F6E56]" :
                            v.status === "approved" ? "border-amber-300 bg-amber-50 text-amber-700" :
                                                      "border-zinc-200 bg-zinc-50 text-zinc-500";
                          const statusLabel =
                            v.status === "active" ? "Aktiv" : v.status === "approved" ? "Godkänd" : "Utkast";
                          const isShown = activeIcp?.icp_id === v.icp_id;
                          return (
                            <div key={v.icp_id} className={`flex items-center gap-[6px] rounded-[6px] border px-[8px] py-[5px] text-[11px] ${isShown ? statusCls : "border-zinc-200 bg-zinc-50 text-zinc-500"}`}>
                              <span className="font-medium">v{v.version}</span>
                              <span className={`rounded-[4px] px-[4px] py-[1px] text-[9px] font-medium ${statusCls}`}>{statusLabel}</span>
                              <span className="text-[9px] text-zinc-400">{fmtDate(v.created_at)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Active ICP detail */}
                  {activeIcp && (
                    <>
                      <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[13px] font-semibold text-zinc-900">ICP v{activeIcp.version}</p>
                          <span className={`rounded-[6px] px-[7px] py-[2px] text-[10px] font-medium ${
                            activeIcp.status === "active"
                              ? "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]"
                              : activeIcp.status === "approved"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-zinc-100 text-zinc-500"
                          }`}>
                            {activeIcp.status === "active" ? "Aktiv" : activeIcp.status === "approved" ? "Godkänd" : "Utkast"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
                          {[
                            { label: "Branschvertikaler", val: activeIcp.industry_verticals },
                            { label: "Företagsstorlekar", val: activeIcp.company_sizes },
                            { label: "Geografier",        val: activeIcp.geographies },
                            { label: "Jobbtitlar",        val: activeIcp.job_titles },
                            { label: "Pain points",       val: activeIcp.pain_points },
                            { label: "Nyckelbudskap",     val: activeIcp.key_messages },
                          ].map(({ label, val }) => (
                            <div key={label}>
                              <p className="text-[10px] text-zinc-400 mb-1">{label}</p>
                              <div className="flex flex-wrap gap-[4px]">
                                {val.map((v) => (
                                  <span key={v} className="rounded-[4px] bg-zinc-100 px-[6px] py-[2px] text-[11px] text-zinc-700">{v}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-3">
                          <p className="text-[10px] text-zinc-400 mb-1">Veckofokus</p>
                          <p className="text-[12px] text-zinc-900">{activeIcp.current_focus || "–"}</p>
                        </div>
                        <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-3">
                          <p className="text-[10px] text-zinc-400 mb-1">Uppskattad audience pool</p>
                          <p className="text-[20px] font-medium text-[#18181B]">{activeIcp.estimated_pool_size.toLocaleString("sv-SE")}</p>
                        </div>
                      </div>

                      {activeIcp.exclusion_domains.length > 0 && (
                        <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-3">
                          <p className="text-[10px] text-zinc-400 mb-2">Exkluderingsdomäner</p>
                          <div className="flex flex-wrap gap-[4px]">
                            {activeIcp.exclusion_domains.map((d) => (
                              <span key={d} className="rounded-[4px] bg-rose-50 px-[6px] py-[2px] text-[11px] text-rose-700">{d}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── TASKS ── */}
          {activeTab === "tasks" && (
            <TasksTab
              tasks={campaign.tasks.map((t) => ({
                ...t,
                due_date: t.due_date,
              }))}
              campaignId={campaign.campaign_id}
              pmId={campaign.assigned_pm_id}
            />
          )}

          {/* ── CHECKLISTOR ── */}
          {activeTab === "checklistor" && (
            <ChecklistsTab
              instances={campaign.checklist_instances.map((inst) => ({
                instance_id:    inst.instance_id,
                completion_pct: inst.completion_pct,
                week_number:    inst.week_number,
                items: (inst.items as Array<{
                  order: number;
                  title: string;
                  description?: string;
                  is_blocking?: boolean;
                  completed?: boolean;
                  completed_at?: string | null;
                }>).map((i) => ({
                  order:        i.order,
                  title:        i.title,
                  description:  i.description,
                  is_blocking:  i.is_blocking,
                  completed:    i.completed ?? false,
                  completed_at: i.completed_at ?? null,
                })),
                template: { type: inst.template.type, name: inst.template.name },
              }))}
            />
          )}

          {/* ── RAPPORTER ── */}
          {activeTab === "rapporter" && (
            <ReportsTab
              reports={campaign.weekly_reports.map((r) => ({
                report_id:      r.report_id,
                week_number:    r.week_number,
                year:           r.year,
                status:         r.status,
                meetings_week:  r.meetings_week,
                meetings_mtd:   r.meetings_mtd,
                meetings_total: r.meetings_total,
                ai_commentary:  r.ai_commentary,
                pm_commentary:  r.pm_commentary,
                next_week_focus: r.next_week_focus,
                sent_at:        r.sent_at ? r.sent_at.toISOString() : null,
              }))}
              campaignId={campaign.campaign_id}
              pmId={campaign.assigned_pm_id}
              clientName={campaign.client_name}
              market={campaign.market}
              currentWeekNumber={currentWeekNumber}
              currentYear={currentYear}
              weeklyMeetingTarget={campaign.weekly_meeting_target}
              monthlyMeetingTarget={campaign.monthly_meeting_target}
              thisWeekActivity={thisWeekActivity}
              meetingsWeek={meetingsWeek}
              meetingsMtd={meetingsMtd}
              currentFocus={activeIcp?.current_focus ?? ""}
              pace={pace}
            />
          )}

        </div>
      </main>
    </div>
  );
}
