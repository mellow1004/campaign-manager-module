import { CampaignStatus, TaskPriority, TaskStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type TabId = "oversikt" | "aktivitet" | "icp" | "tasks" | "checklistor" | "rapporter";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "oversikt",    label: "Översikt" },
  { id: "aktivitet",  label: "Aktivitet" },
  { id: "icp",        label: "ICP" },
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

const STATUS_CLS: Record<CampaignStatus, string> = {
  active:     "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]",
  paused:     "bg-zinc-100 text-zinc-600",
  onboarding: "bg-sky-100 text-sky-700",
  closing:    "bg-amber-100 text-amber-700",
  closed:     "bg-zinc-100 text-zinc-500",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = { high: "Hög", medium: "Medium", low: "Låg" };
const PRIORITY_CLS: Record<TaskPriority, string> = {
  high:   "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-zinc-100 text-zinc-600",
};
const TASK_STATUS_LABELS: Record<TaskStatus, string> = { open: "Öppen", in_progress: "Pågår", done: "Klar" };

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

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
        where: { status: "active" },
        take: 1,
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

  const meetingsWeek = campaign.activity_logs
    .filter((l) => l.date >= weekStart)
    .reduce((s, l) => s + l.meetings_booked, 0);
  const meetingsMtd = campaign.activity_logs
    .filter((l) => l.date >= monthStart)
    .reduce((s, l) => s + l.meetings_booked, 0);
  const liAccepted = campaign.activity_logs.reduce((s, l) => s + l.linkedin_accepted, 0);
  const liRequests = campaign.activity_logs.reduce((s, l) => s + l.linkedin_requests, 0);
  const liAcceptRate = liRequests > 0 ? Math.round((liAccepted / liRequests) * 100) : 0;

  const reportDaysLeft = daysToTuesday(today);
  const icp = campaign.icps[0] ?? null;

  // Group activity logs by ISO week
  type WeekGroup = {
    weekKey: string;
    label: string;
    logs: typeof campaign.activity_logs;
  };
  const weekMap = new Map<string, WeekGroup>();
  for (const log of campaign.activity_logs) {
    const ws = getWeekStart(log.date);
    const key = ws.toISOString();
    if (!weekMap.has(key)) {
      weekMap.set(key, { weekKey: key, label: `v.${isoWeek(ws)} – ${fmtShort(ws)}`, logs: [] });
    }
    weekMap.get(key)!.logs.push(log);
  }
  const weekGroups = Array.from(weekMap.values());

  // Tasks grouped by status
  const openTasks      = campaign.tasks.filter((t) => t.status === "open");
  const inProgressTasks = campaign.tasks.filter((t) => t.status === "in_progress");
  const doneTasks      = campaign.tasks.filter((t) => t.status === "done").slice(0, 5);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F4F5] text-zinc-900" style={{ fontSize: 13 }}>

      {/* SIDEBAR */}
      <aside className="flex w-[200px] min-w-[200px] shrink-0 flex-col bg-[#18181B]">
        <div className="border-b border-white/[0.07] px-4 py-3">
          <p className="text-[15px] font-medium text-white leading-tight">Otto</p>
          <p className="text-[10px] text-white/35 leading-tight mt-[1px]">CoSeller Suite</p>
        </div>
        <nav className="flex-1 space-y-[2px] px-2 py-3">
          {[
            { label: "▦ Dashboard",  href: "/dashboard", active: false, badge: null },
            { label: "◈ Kampanjer",  href: "#",          active: true,  badge: null },
            { label: "✓ Mina todos", href: "#",          active: false, badge: 5 },
            { label: "↗ Rapporter",  href: "#",          active: false, badge: null },
            { label: "≡ Checklistor",href: "#",          active: false, badge: null },
            { label: "⚙ ICP-bibliotek",href:"#",         active: false, badge: null },
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
        <div className="shrink-0 border-b border-zinc-200 bg-white">
          {/* Header row: name + status + meta */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-[10px]">
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-600 text-[11px]">← Dashboard</Link>
              <span className="text-zinc-300">/</span>
              <h1 className="text-[14px] font-semibold text-[#18181B]">{campaign.client_name}</h1>
              <span className={`rounded-[10px] px-[7px] py-[2px] text-[10px] font-medium ${STATUS_CLS[campaign.status]}`}>
                {STATUS_LABELS[campaign.status]}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Rapport om{" "}
              <span className={`font-medium ${reportDaysLeft === 0 ? "text-[#E24B4A]" : "text-[#EF9F27]"}`}>
                {reportDaysLeft === 0 ? "idag" : `${reportDaysLeft} dagar`}
              </span>
            </p>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-5 divide-x divide-zinc-100 px-0">
            {[
              { label: "Möten totalt",   val: campaign.meetings_booked_mtd },
              { label: "MTD",            val: meetingsMtd, sub: `mål: ${campaign.monthly_meeting_target}` },
              { label: "Veckan",         val: meetingsWeek, sub: `mål: ${campaign.weekly_meeting_target}` },
              { label: "LI-accept-rate", val: `${liAcceptRate}%` },
              { label: "Rapport deadline",val: "Tisdag EOD", valCls: "text-[13px]" },
            ].map(({ label, val, sub, valCls }) => (
              <div key={label} className="px-4 py-[8px]">
                <p className="text-[10px] text-zinc-400 leading-tight">{label}</p>
                <p className={`font-semibold leading-tight ${valCls ?? "text-[15px] text-[#18181B]"}`}>{val}</p>
                {sub && <p className="text-[10px] text-zinc-400 leading-tight">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Tab navigation */}
          <div className="flex items-center gap-[2px] border-t border-zinc-100 px-4 py-[6px]">
            {TABS.map((tab) => (
              <Link key={tab.id} href={`/dashboard/${campaign.campaign_id}?tab=${tab.id}`}
                className={`rounded-[5px] px-3 py-[4px] text-[12px] leading-tight transition ${
                  activeTab === tab.id
                    ? "bg-[rgba(29,158,117,0.12)] text-[#0F6E56] font-medium"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                }`}>
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        {/* TAB CONTENT */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* ── ÖVERSIKT ── */}
          {activeTab === "oversikt" && (
            <div className="space-y-3">
              {/* Meta row */}
              <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-3">
                <div className="grid grid-cols-5 gap-x-4 gap-y-1 text-[12px]">
                  <div><span className="text-zinc-400 text-[10px]">PM</span><p className="font-medium">{campaign.assigned_pm.name}</p></div>
                  <div><span className="text-zinc-400 text-[10px]">TL</span><p className="font-medium">{campaign.assigned_tl.name}</p></div>
                  <div><span className="text-zinc-400 text-[10px]">Start</span><p className="font-medium">{fmtDate(campaign.start_date)}</p></div>
                  <div><span className="text-zinc-400 text-[10px]">Slut</span><p className="font-medium">{fmtDate(campaign.end_date)}</p></div>
                  <div><span className="text-zinc-400 text-[10px]">Kontrakt</span><p className="font-medium capitalize">{campaign.contract_type}</p></div>
                </div>
              </div>

              {/* KPI summary */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Möten veckan",   val: meetingsWeek, sub: `mål ${campaign.weekly_meeting_target}`,   pct: campaign.weekly_meeting_target > 0 ? Math.round((meetingsWeek/campaign.weekly_meeting_target)*100) : 0 },
                  { label: "MTD-möten",       val: meetingsMtd, sub: `mål ${campaign.monthly_meeting_target}`,  pct: campaign.monthly_meeting_target > 0 ? Math.round((meetingsMtd/campaign.monthly_meeting_target)*100) : 0 },
                  { label: "Hälsoindex",      val: campaign.health_score, sub: campaign.health_score < 40 ? "Röd" : campaign.health_score < 75 ? "Gul" : "Grön", pct: campaign.health_score },
                  { label: "LI-accept-rate",  val: `${liAcceptRate}%`,   sub: `${liAccepted}/${liRequests} accepterade`, pct: liAcceptRate },
                ].map(({ label, val, sub, pct }) => (
                  <div key={label} className="rounded-[8px] border border-zinc-200 bg-white px-[14px] py-[10px]">
                    <p className="text-[10px] text-zinc-400 leading-tight">{label}</p>
                    <p className="mt-1 text-[20px] font-medium text-[#18181B] leading-tight">{val}</p>
                    <p className="mt-[2px] text-[10px] text-zinc-400 leading-tight">{sub}</p>
                    <div className="mt-2 h-[3px] w-full rounded-full bg-zinc-100">
                      <div className={`h-full rounded-full ${pct < 40 ? "bg-[#E24B4A]" : pct < 75 ? "bg-[#EF9F27]" : "bg-[#1D9E75]"}`} style={{ width: `${Math.min(100,pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Open tasks */}
              <div className="rounded-[8px] border border-zinc-200 bg-white">
                <div className="border-b border-zinc-100 px-4 py-[8px]">
                  <p className="text-[12px] font-medium text-zinc-700">Öppna tasks (top 5)</p>
                </div>
                {campaign.tasks.filter(t => t.status !== "done").slice(0,5).length === 0 ? (
                  <p className="px-4 py-3 text-[12px] text-zinc-400">Inga öppna tasks.</p>
                ) : (
                  <div>
                    {campaign.tasks.filter(t => t.status !== "done").slice(0,5).map((task, i) => (
                      <div key={task.task_id} className={`flex items-center gap-3 px-4 py-[8px] ${i % 2 === 1 ? "bg-zinc-50" : ""}`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-zinc-900">{task.title}</p>
                          <p className="text-[10px] text-zinc-400">{task.assigned_to.name} · Förfall {fmtDate(task.due_date)}</p>
                        </div>
                        <span className={`shrink-0 rounded-[6px] px-[6px] py-[2px] text-[10px] font-medium ${PRIORITY_CLS[task.priority]}`}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                        <span className="shrink-0 text-[10px] text-zinc-400">{TASK_STATUS_LABELS[task.status]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── AKTIVITET ── */}
          {activeTab === "aktivitet" && (
            <div className="space-y-3">
              <div className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
                <div className="border-b border-zinc-100 px-4 py-[8px] flex items-center justify-between">
                  <p className="text-[12px] font-medium text-zinc-700">Aktivitetslogg</p>
                  <span className="text-[10px] text-zinc-400">{campaign.activity_logs.length} rader</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50">
                        {["Datum","Dials","Connects","Email skickade","Svar","LI förfr.","LI accept.","Möten"].map((h) => (
                          <th key={h} className="whitespace-nowrap px-3 py-[6px] text-left font-medium text-zinc-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weekGroups.map((wg) => {
                        const totals = wg.logs.reduce(
                          (acc, l) => ({
                            dials: acc.dials + l.dials,
                            connects: acc.connects + l.connects,
                            emails_sent: acc.emails_sent + l.emails_sent,
                            replies: acc.replies + l.replies,
                            linkedin_requests: acc.linkedin_requests + l.linkedin_requests,
                            linkedin_accepted: acc.linkedin_accepted + l.linkedin_accepted,
                            meetings_booked: acc.meetings_booked + l.meetings_booked,
                          }),
                          { dials:0, connects:0, emails_sent:0, replies:0, linkedin_requests:0, linkedin_accepted:0, meetings_booked:0 }
                        );
                        return (
                          <>
                            {wg.logs.map((log, li) => (
                              <tr key={log.log_id} className={`border-b border-zinc-50 hover:bg-zinc-50 ${li % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}>
                                <td className="whitespace-nowrap px-3 py-[5px] text-zinc-600">{fmtShort(log.date)}</td>
                                <td className="px-3 py-[5px] text-right font-medium">{log.dials}</td>
                                <td className="px-3 py-[5px] text-right font-medium">{log.connects}</td>
                                <td className="px-3 py-[5px] text-right font-medium">{log.emails_sent}</td>
                                <td className="px-3 py-[5px] text-right font-medium">{log.replies}</td>
                                <td className="px-3 py-[5px] text-right font-medium">{log.linkedin_requests}</td>
                                <td className="px-3 py-[5px] text-right font-medium">{log.linkedin_accepted}</td>
                                <td className="px-3 py-[5px] text-right font-bold text-[#18181B]">{log.meetings_booked}</td>
                              </tr>
                            ))}
                            {/* Week summary row */}
                            <tr className="border-b border-zinc-200 bg-zinc-100 text-[11px]">
                              <td className="whitespace-nowrap px-3 py-[5px] font-semibold text-zinc-700">{wg.label}</td>
                              <td className="px-3 py-[5px] text-right font-semibold text-zinc-700">{totals.dials}</td>
                              <td className="px-3 py-[5px] text-right font-semibold text-zinc-700">{totals.connects}</td>
                              <td className="px-3 py-[5px] text-right font-semibold text-zinc-700">{totals.emails_sent}</td>
                              <td className="px-3 py-[5px] text-right font-semibold text-zinc-700">{totals.replies}</td>
                              <td className="px-3 py-[5px] text-right font-semibold text-zinc-700">{totals.linkedin_requests}</td>
                              <td className="px-3 py-[5px] text-right font-semibold text-zinc-700">{totals.linkedin_accepted}</td>
                              <td className="px-3 py-[5px] text-right font-bold text-[#1D9E75]">{totals.meetings_booked}</td>
                            </tr>
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                  {campaign.activity_logs.length === 0 && (
                    <p className="px-4 py-4 text-[12px] text-zinc-400">Ingen aktivitet loggad än.</p>
                  )}
                </div>
              </div>

              {/* Channel stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Telefon",
                    primary: campaign.activity_logs.reduce((s,l)=>s+l.dials,0),
                    primaryLabel: "Dials totalt",
                    secondary: campaign.activity_logs.reduce((s,l)=>s+l.connects,0),
                    secondaryLabel: "Connects",
                    rate: (() => {
                      const d = campaign.activity_logs.reduce((s,l)=>s+l.dials,0);
                      const c = campaign.activity_logs.reduce((s,l)=>s+l.connects,0);
                      return d > 0 ? `${Math.round((c/d)*100)}%` : "–";
                    })(),
                    rateLabel: "Connect-rate",
                    cls: "bg-[rgba(127,119,221,0.08)]",
                  },
                  {
                    label: "Email",
                    primary: campaign.activity_logs.reduce((s,l)=>s+l.emails_sent,0),
                    primaryLabel: "Skickade",
                    secondary: campaign.activity_logs.reduce((s,l)=>s+l.replies,0),
                    secondaryLabel: "Svar",
                    rate: (() => {
                      const sent = campaign.activity_logs.reduce((s,l)=>s+l.emails_sent,0);
                      const rep  = campaign.activity_logs.reduce((s,l)=>s+l.replies,0);
                      return sent > 0 ? `${Math.round((rep/sent)*100)}%` : "–";
                    })(),
                    rateLabel: "Svarsfrekvens",
                    cls: "bg-[rgba(29,158,117,0.08)]",
                  },
                  {
                    label: "LinkedIn",
                    primary: liRequests,
                    primaryLabel: "Förfrågningar",
                    secondary: liAccepted,
                    secondaryLabel: "Accepterade",
                    rate: liAcceptRate > 0 ? `${liAcceptRate}%` : "–",
                    rateLabel: "Accept-rate",
                    cls: "bg-[rgba(55,138,221,0.08)]",
                  },
                ].map(({ label, primary, primaryLabel, secondary, secondaryLabel, rate, rateLabel, cls }) => (
                  <div key={label} className={`rounded-[8px] border border-zinc-200 px-4 py-3 ${cls}`}>
                    <p className="text-[11px] font-medium text-zinc-700 mb-2">{label}</p>
                    <div className="flex justify-between text-[12px]">
                      <div>
                        <p className="text-[10px] text-zinc-400">{primaryLabel}</p>
                        <p className="text-[18px] font-medium text-[#18181B]">{primary}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400">{secondaryLabel}</p>
                        <p className="text-[18px] font-medium text-[#18181B]">{secondary}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400">{rateLabel}</p>
                        <p className="text-[18px] font-medium text-[#1D9E75]">{rate}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ICP ── */}
          {activeTab === "icp" && (
            <div className="space-y-3">
              {!icp ? (
                <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-6 text-center text-[12px] text-zinc-400">
                  Ingen aktiv ICP-profil för denna kampanj.
                </div>
              ) : (
                <>
                  <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[13px] font-semibold text-zinc-900">ICP v{icp.version}</p>
                      <span className="rounded-[6px] bg-[rgba(29,158,117,0.1)] px-[7px] py-[2px] text-[10px] font-medium text-[#0F6E56]">Aktiv</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
                      {[
                        { label: "Branschvertikaler",   val: icp.industry_verticals },
                        { label: "Företagsstorlekar",   val: icp.company_sizes },
                        { label: "Geografier",          val: icp.geographies },
                        { label: "Jobbtitlar",          val: icp.job_titles },
                        { label: "Pain points",         val: icp.pain_points },
                        { label: "Nyckelbudskap",       val: icp.key_messages },
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
                      <p className="text-[12px] text-zinc-900">{icp.current_focus || "–"}</p>
                    </div>
                    <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-3">
                      <p className="text-[10px] text-zinc-400 mb-1">Uppskattad audience pool</p>
                      <p className="text-[20px] font-medium text-[#18181B]">{icp.estimated_pool_size.toLocaleString("sv-SE")}</p>
                    </div>
                  </div>

                  {icp.exclusion_domains.length > 0 && (
                    <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-3">
                      <p className="text-[10px] text-zinc-400 mb-2">Exkluderingsdomäner</p>
                      <div className="flex flex-wrap gap-[4px]">
                        {icp.exclusion_domains.map((d) => (
                          <span key={d} className="rounded-[4px] bg-rose-50 px-[6px] py-[2px] text-[11px] text-rose-700">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── TASKS ── */}
          {activeTab === "tasks" && (
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: "open",        label: "Öppen",   tasks: openTasks,       headerCls: "bg-zinc-50" },
                { key: "in_progress", label: "Pågår",   tasks: inProgressTasks, headerCls: "bg-amber-50" },
                { key: "done",        label: "Klar",    tasks: doneTasks,       headerCls: "bg-[rgba(29,158,117,0.07)]" },
              ] as const).map((col) => (
                <div key={col.key} className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
                  <div className={`border-b border-zinc-100 px-3 py-[8px] flex items-center justify-between ${col.headerCls}`}>
                    <p className="text-[12px] font-medium text-zinc-700">{col.label}</p>
                    <span className="rounded-full bg-zinc-200 px-[7px] py-[1px] text-[10px] text-zinc-600">{col.tasks.length}</span>
                  </div>
                  <div className="space-y-[1px] p-2">
                    {col.tasks.length === 0 && (
                      <p className="py-3 text-center text-[11px] text-zinc-400">Inga tasks</p>
                    )}
                    {col.tasks.map((task) => {
                      const isOverdue = task.due_date < today && task.status !== "done";
                      return (
                        <div key={task.task_id} className="rounded-[6px] border border-zinc-100 bg-zinc-50 p-[8px] hover:border-zinc-200">
                          <p className="text-[12px] font-medium text-zinc-900 leading-tight mb-[4px]">{task.title}</p>
                          {task.description && (
                            <p className="text-[10px] text-zinc-400 leading-tight mb-[6px] line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`rounded-[4px] px-[5px] py-[1px] text-[9px] font-medium ${PRIORITY_CLS[task.priority]}`}>
                              {PRIORITY_LABELS[task.priority]}
                            </span>
                            <span className={`text-[9px] ${isOverdue ? "text-[#E24B4A] font-medium" : "text-zinc-400"}`}>
                              {isOverdue ? "⚠ " : ""}Förfall {fmtShort(task.due_date)}
                            </span>
                            <span className="ml-auto text-[9px] text-zinc-400">{task.assigned_to.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── CHECKLISTOR ── */}
          {activeTab === "checklistor" && (
            <div className="space-y-3">
              {campaign.checklist_instances.length === 0 ? (
                <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-6 text-center text-[12px] text-zinc-400">
                  Inga checklistor skapade för denna kampanj.
                </div>
              ) : (
                campaign.checklist_instances.map((inst) => {
                  const items = inst.items as Array<{
                    order: number;
                    title: string;
                    description?: string;
                    is_blocking?: boolean;
                    completed?: boolean;
                    completed_at?: string;
                  }>;
                  const completedCount = items.filter((i) => i.completed).length;
                  return (
                    <div key={inst.instance_id} className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
                      <div className="border-b border-zinc-100 px-4 py-[8px] flex items-center justify-between bg-zinc-50">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-medium text-zinc-700">{inst.template.name}</p>
                          {inst.week_number && (
                            <span className="text-[10px] text-zinc-400">v.{inst.week_number}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-[3px] w-[60px] rounded-full bg-zinc-200">
                            <div
                              className={`h-full rounded-full ${inst.completion_pct < 40 ? "bg-[#E24B4A]" : inst.completion_pct < 75 ? "bg-[#EF9F27]" : "bg-[#1D9E75]"}`}
                              style={{ width: `${inst.completion_pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-zinc-500">{completedCount}/{items.length}</span>
                        </div>
                      </div>
                      <div>
                        {items.sort((a,b)=>a.order-b.order).map((item, ii) => (
                          <div key={item.order} className={`flex items-start gap-3 px-4 py-[8px] border-b border-zinc-50 last:border-0 ${ii % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}>
                            <div className={`mt-[1px] h-[14px] w-[14px] shrink-0 rounded-[3px] border-2 flex items-center justify-center ${item.completed ? "bg-[#1D9E75] border-[#1D9E75]" : "border-zinc-300"}`}>
                              {item.completed && <span className="text-white text-[8px] font-bold">✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <p className={`text-[12px] leading-tight ${item.completed ? "line-through text-zinc-400" : "text-zinc-900"}`}>
                                  {item.title}
                                </p>
                                {item.is_blocking && !item.completed && (
                                  <span className="text-[10px]" title="Blockerande item">🔒</span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-[10px] text-zinc-400 leading-tight mt-[2px]">{item.description}</p>
                              )}
                            </div>
                            {item.completed_at && (
                              <span className="shrink-0 text-[9px] text-zinc-400">{fmtShort(new Date(item.completed_at))}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── RAPPORTER ── */}
          {activeTab === "rapporter" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-zinc-400">
                  {campaign.weekly_reports.length} rapporter totalt
                </p>
                <button className="rounded-[6px] border border-[#1D9E75] bg-[rgba(29,158,117,0.07)] px-[10px] py-[5px] text-[11px] text-[#1D9E75] font-medium">
                  + Generera rapport
                </button>
              </div>

              {campaign.weekly_reports.length === 0 ? (
                <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-6 text-center text-[12px] text-zinc-400">
                  Inga rapporter genererade än.
                </div>
              ) : (
                <div className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50">
                        {["Vecka","Period","Möten","MTD","Status","Skickad",""].map((h) => (
                          <th key={h} className="px-4 py-[7px] text-left font-medium text-zinc-500 text-[10px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campaign.weekly_reports.map((report, ri) => (
                        <tr key={report.report_id} className={`border-b border-zinc-50 hover:bg-zinc-50 ${ri % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}>
                          <td className="px-4 py-[7px] font-medium text-zinc-900">v.{report.week_number} {report.year}</td>
                          <td className="px-4 py-[7px] text-zinc-500">–</td>
                          <td className="px-4 py-[7px] font-medium">{report.meetings_week}</td>
                          <td className="px-4 py-[7px] text-zinc-600">{report.meetings_mtd}</td>
                          <td className="px-4 py-[7px]">
                            <span className={`rounded-[6px] px-[6px] py-[2px] text-[10px] font-medium ${
                              report.status === "sent"
                                ? "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {report.status === "sent" ? "Skickad" : "Utkast"}
                            </span>
                          </td>
                          <td className="px-4 py-[7px] text-zinc-400 text-[11px]">
                            {report.sent_at ? fmtShort(new Date(report.sent_at)) : "–"}
                          </td>
                          <td className="px-4 py-[7px]">
                            <button className="text-[11px] text-zinc-400 hover:text-zinc-700">Visa →</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
