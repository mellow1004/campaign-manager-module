import { CampaignStatus } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

type HealthLevel = "green" | "yellow" | "red";

const STATUS_LABELS: Record<CampaignStatus, string> = {
  onboarding: "Onboarding",
  active: "Aktiv",
  paused: "Pausad",
  closing: "Avslutar",
  closed: "Avslutad",
};

const CHANNEL_LABELS: Record<string, { label: string; cls: string }> = {
  phone:    { label: "Telefon",  cls: "bg-[rgba(127,119,221,0.12)] text-[#534AB7]" },
  email:    { label: "Email",    cls: "bg-[rgba(29,158,117,0.12)] text-[#0F6E56]" },
  linkedin: { label: "LinkedIn", cls: "bg-[rgba(55,138,221,0.12)] text-[#185FA5]" },
};

const STATUS_CLS: Record<CampaignStatus, string> = {
  active:     "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]",
  paused:     "bg-zinc-100 text-zinc-500",
  onboarding: "bg-sky-100 text-sky-700",
  closing:    "bg-amber-100 text-amber-700",
  closed:     "bg-zinc-100 text-zinc-400",
};

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

function healthLevel(score: number): HealthLevel {
  return score < 40 ? "red" : score < 75 ? "yellow" : "green";
}

function healthCls(level: HealthLevel) {
  return level === "green" ? "bg-[#1D9E75]" : level === "yellow" ? "bg-[#EF9F27]" : "bg-[#E24B4A]";
}

function barCls(pct: number) {
  return pct < 40 ? "bg-[#E24B4A]" : pct < 75 ? "bg-[#EF9F27]" : "bg-[#1D9E75]";
}

function daysToTuesday(date: Date): number {
  const d = date.getDay();
  // If today is Tuesday (d===2) return 7 so it says "7 dagar" (next week's deadline),
  // not 0 (which made it look like every single report was due "today")
  const raw = (2 - d + 7) % 7;
  return raw === 0 ? 7 : raw;
}

type FilterType = "alla" | "aktiva" | "atgard";

interface PageProps {
  searchParams?: Promise<{ filter?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : undefined;
  const activeFilter: FilterType =
    sp?.filter === "aktiva" ? "aktiva" :
    sp?.filter === "atgard" ? "atgard" : "alla";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = getWeekStart(today);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  // How many days into the current week are we? (Mon=0, Tue=1, …)
  const dayOfWeek = today.getDay();
  const daysIntoWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  // Cutoff for "same point last week" — gives a fair day-for-day comparison
  const samePointLastWeek = new Date(prevWeekStart);
  samePointLastWeek.setDate(samePointLastWeek.getDate() + daysIntoWeek);

  const [campaigns, pm] = await Promise.all([
    prisma.campaign.findMany({
      select: {
        campaign_id: true,
        client_name: true,
        market: true,
        channels_enabled: true,
        status: true,
        health_score: true,
        weekly_meeting_target: true,
        monthly_meeting_target: true,
        meetings_booked_mtd: true,
        activity_logs: {
          where: { date: { gte: prevWeekStart, lte: today } },
          select: { date: true, meetings_booked: true },
        },
        tasks: {
          where: { status: { in: ["open", "in_progress"] }, due_date: { lt: today } },
          select: { task_id: true, priority: true },
        },
      },
      orderBy: { client_name: "asc" },
    }),
    prisma.user.findFirst({ where: { role: "pm" }, select: { name: true, avatar_initials: true } }),
  ]);

  const allCards = campaigns.map((c) => {
    const thisWeek = c.activity_logs
      .filter((l) => l.date >= weekStart)
      .reduce((s, l) => s + l.meetings_booked, 0);
    const lastWeek = c.activity_logs
      .filter((l) => l.date >= prevWeekStart && l.date <= samePointLastWeek)
      .reduce((s, l) => s + l.meetings_booked, 0);
    const overdueHighPrio = c.tasks.filter((t) => t.priority === "high").length;
    const needsAction = c.health_score < 75 || overdueHighPrio > 0;
    return { c, thisWeek, lastWeek, overdueHighPrio, needsAction };
  });

  const cards = activeFilter === "aktiva"
    ? allCards.filter((x) => x.c.status === "active")
    : activeFilter === "atgard"
    ? allCards.filter((x) => x.needsAction)
    : allCards;

  const totalThis  = cards.reduce((s, x) => s + x.thisWeek, 0);
  const totalLast  = cards.reduce((s, x) => s + x.lastWeek, 0);
  const delta      = totalThis - totalLast;
  const avgHealth  = campaigns.length ? Math.round(campaigns.reduce((s, c) => s + c.health_score, 0) / campaigns.length) : 0;
  const redCount   = campaigns.filter((c) => c.health_score < 40).length;
  const activeCount   = campaigns.filter((c) => c.status === "active").length;
  const pausedCount   = campaigns.filter((c) => c.status === "paused").length;
  const closingCount  = campaigns.filter((c) => c.status === "closing").length;
  const reportsCount  = campaigns.filter((c) => ["active","closing"].includes(c.status)).length;
  const dayNames = ["söndag","måndag","tisdag","onsdag","torsdag","fredag","lördag"];
  const monthNames = ["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"];
  const dateLabel = `${dayNames[today.getDay()].charAt(0).toUpperCase()}${dayNames[today.getDay()].slice(1)} ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()} · v.${isoWeek(today)}`;

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
            { label: "▦ Dashboard", active: true, badge: null },
            { label: "◈ Kampanjer", active: false, badge: campaigns.length },
            { label: "✓ Mina todos", active: false, badge: 5 },
            { label: "↗ Rapporter", active: false, badge: null },
            { label: "≡ Checklistor", active: false, badge: null },
            { label: "⚙ ICP-bibliotek", active: false, badge: null },
          ].map(({ label, active, badge }) => (
            <div key={label} className={`flex items-center gap-2 rounded-[6px] px-[10px] py-2 text-[12px] leading-tight cursor-pointer ${active ? "bg-[rgba(29,158,117,0.2)] text-[#3ECFA0]" : "text-white/45"}`}>
              {label}
              {badge !== null && (
                <span className="ml-auto rounded-[10px] bg-[rgba(226,75,74,0.25)] px-[6px] py-[1px] text-[10px] text-[#F09595]">{badge}</span>
              )}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-white/[0.07] px-[14px] py-3">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-[10px] font-medium text-white">
            {pm?.avatar_initials ?? "PM"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] text-white/60 leading-tight">{pm?.name ?? "Project Manager"}</p>
            <p className="text-[10px] text-white/30 leading-tight mt-[1px]">Project Manager</p>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex flex-1 flex-col overflow-hidden">

        {/* TOPBAR */}
        <header className="flex h-[50px] shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5">
          <div>
            <p className="text-[14px] font-medium text-[#18181B] leading-tight">Kampanjöversikt</p>
            <p className="text-[11px] text-zinc-400 leading-tight mt-[1px]">{dateLabel}</p>
          </div>
          <div className="flex gap-[6px]">
            {([
              { label: "Alla",           filter: "alla",   count: allCards.length },
              { label: "Aktiva",         filter: "aktiva", count: allCards.filter(x => x.c.status === "active").length },
              { label: "⚠ Kräver åtgärd", filter: "atgard", count: allCards.filter(x => x.needsAction).length },
            ] as const).map(({ label, filter, count }) => {
              const isActive = activeFilter === filter;
              return (
                <Link key={filter} href={filter === "alla" ? "/dashboard" : `/dashboard?filter=${filter}`}
                  className={`rounded-[6px] px-[10px] py-[5px] text-[11px] border leading-tight ${
                    isActive
                      ? "border-[#1D9E75] bg-[rgba(29,158,117,0.07)] text-[#1D9E75]"
                      : "border-zinc-200 bg-[#F4F4F5] text-zinc-500 hover:border-zinc-300"
                  }`}>
                  {label}
                  {count !== allCards.length && (
                    <span className="ml-1 text-[10px] opacity-70">({count})</span>
                  )}
                </Link>
              );
            })}
          </div>
        </header>

        {/* STATS ROW — 4 separate white cards */}
        <div className="grid shrink-0 grid-cols-4 gap-[10px] px-5 py-[14px]">
          {[
            {
              label: "Aktiva kampanjer",
              val: campaigns.length,
              sub: `${activeCount} aktiva · ${pausedCount} pausar · ${closingCount} avslutar`,
              subCls: "text-zinc-500",
            },
            {
              label: "Möten bokat i veckan",
              val: totalThis,
              sub: totalLast === 0
                ? "ingen data förra veckan"
                : `${delta >= 0 ? "+" : ""}${delta} vs förra veckan`,
              subCls: totalLast === 0
                ? "text-zinc-400"
                : delta >= 0 ? "text-[#1D9E75]" : "text-[#E24B4A]",
            },
            {
              label: "Rapporter att skicka",
              val: reportsCount,
              sub: "Deadline: tisdag EOD",
              subCls: "text-zinc-500",
              valCls: "text-[#EF9F27]",
            },
            {
              label: "Snitt hälsopoäng",
              val: avgHealth,
              sub: `${redCount} kampanjer i rött`,
              subCls: "text-zinc-500",
            },
          ].map(({ label, val, sub, subCls, valCls }) => (
            <div key={label} className="rounded-[8px] border border-zinc-200 bg-white px-[14px] py-[10px]">
              <p className="text-[10px] uppercase tracking-[0.4px] text-zinc-500 leading-tight">{label}</p>
              <p className={`mt-1 text-[20px] font-medium leading-tight ${valCls ?? "text-[#18181B]"}`}>{val}</p>
              <p className={`mt-[3px] text-[10px] leading-tight ${subCls}`}>{sub}</p>
            </div>
          ))}
        </div>

        {/* CAMPAIGN GRID */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <p className="mb-[10px] text-[11px] font-medium uppercase tracking-[0.5px] text-zinc-500">Aktiva kampanjer</p>
          <div className="grid grid-cols-3 gap-[10px] max-lg:grid-cols-2">
            {cards.map(({ c, thisWeek }) => {
              const weekPct = c.weekly_meeting_target > 0 ? Math.min(100, Math.round((thisWeek / c.weekly_meeting_target) * 100)) : 0;
              const mtdPct = c.monthly_meeting_target > 0
                ? Math.min(100, Math.round((c.meetings_booked_mtd / c.monthly_meeting_target) * 100))
                : 0;
              const hl = healthLevel(c.health_score);
              const warningCount = hl === "red" ? 4 : 2;
              const daysLeft = daysToTuesday(today);
              const reportText = daysLeft === 0 ? "idag" : `${daysLeft} ${daysLeft === 1 ? "dag" : "dagar"}`;
              return (
                <Link key={c.campaign_id} href={`/dashboard/${c.campaign_id}`}
                  className="block cursor-pointer rounded-[10px] border border-zinc-200 bg-white p-[14px] transition hover:border-zinc-400 hover:shadow-sm">

                  {/* ROW 1: name + health dot */}
                  <div className="flex items-start justify-between mb-[10px]">
                    <div>
                      <p className="text-[13px] font-medium text-[#18181B] leading-tight">{c.client_name}</p>
                      <p className="text-[10px] text-zinc-400 leading-tight mt-[2px]">{c.market.replace(/\//g, " · ")}</p>
                    </div>
                    <span className={`mt-[3px] h-2 w-2 shrink-0 rounded-full ${healthCls(hl)}`} />
                  </div>

                  {/* ROW 2: channels */}
                  <div className="flex items-center gap-[4px] mb-[10px]">
                    {c.channels_enabled.map((ch) => {
                      const { label, cls } = CHANNEL_LABELS[ch] ?? { label: ch, cls: "bg-zinc-100 text-zinc-500" };
                      return <span key={ch} className={`shrink-0 rounded-[4px] px-[6px] py-[2px] text-[9px] font-medium leading-tight ${cls}`}>{label}</span>;
                    })}
                  </div>

                  {/* ROW 3: metric boxes */}
                  <div className="grid grid-cols-2 gap-[6px] mb-[10px]">
                    <div className="rounded-[6px] bg-[#F4F4F5] px-[9px] py-[7px]">
                      <p className="text-[9px] text-zinc-500 leading-tight mb-[2px]">Möten veckan</p>
                      <p className="text-[14px] font-medium text-[#18181B] leading-tight">{thisWeek}</p>
                      <p className="text-[9px] text-zinc-500 leading-tight mt-[1px]">mål: {c.weekly_meeting_target}</p>
                      <div className="mt-[4px] h-[3px] w-full rounded-full bg-zinc-200">
                        <div className={`h-full rounded-full ${barCls(weekPct)}`} style={{ width: `${weekPct}%` }} />
                      </div>
                    </div>

                    <div className="rounded-[6px] bg-[#F4F4F5] px-[9px] py-[7px]">
                      <p className="text-[9px] text-zinc-500 leading-tight mb-[2px]">MTD-möten</p>
                      <p className="text-[14px] font-medium text-[#18181B] leading-tight">{c.meetings_booked_mtd}</p>
                      <p className="text-[9px] text-zinc-500 leading-tight mt-[1px]">mål: {c.monthly_meeting_target}</p>
                      <div className="mt-[4px] h-[3px] w-full rounded-full bg-zinc-200">
                        <div className={`h-full rounded-full ${barCls(mtdPct)}`} style={{ width: `${mtdPct}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* ROW 4: footer */}
                  <div className="flex items-center justify-between border-t border-[#F4F4F5] pt-[9px]">
                    <p className="text-[10px] text-zinc-500">
                      Rapport om <span className={`font-medium ${daysLeft === 0 ? "text-[#E24B4A]" : "text-[#EF9F27]"}`}>{reportText}</span>
                    </p>
                    {hl === "green" ? (
                      <span className={`shrink-0 rounded-[10px] px-[7px] py-[2px] text-[9px] font-medium leading-tight ${STATUS_CLS[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-[10px] bg-[rgba(226,75,74,0.1)] px-[7px] py-[2px] text-[9px] font-medium leading-tight text-[#A32D2D]">
                        {warningCount} varningar
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
