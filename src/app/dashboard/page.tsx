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

/** Dagar till nästa rapportdeadline (tisdag). På tisdag = 0 → visa "idag" som i mockup 01. */
function daysToTuesday(date: Date): number {
  const d = date.getDay();
  const raw = (2 - d + 7) % 7;
  return raw;
}

type FilterType = "alla" | "aktiva" | "atgard";

interface PageProps {
  searchParams?: Promise<{ filter?: string; search?: string; market?: string; health?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : undefined;
  const activeFilter: FilterType =
    sp?.filter === "aktiva" ? "aktiva" :
    sp?.filter === "atgard" ? "atgard" : "alla";
  const activeSearch = sp?.search?.trim() ?? "";
  const activeMarket = sp?.market ?? "";
  const activeHealth = sp?.health ?? "";

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

  const [campaigns, pm, openTodoCount] = await Promise.all([
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
        weekly_reports: {
          where: { year: today.getFullYear() },
          select: { week_number: true, status: true },
          orderBy: { week_number: "desc" },
          take: 2,
        },
        tasks: {
          where: { status: { in: ["open", "in_progress"] }, due_date: { lt: today } },
          select: { task_id: true, priority: true },
        },
      },
      orderBy: { client_name: "asc" },
    }),
    prisma.user.findFirst({ where: { role: "pm" }, select: { name: true, avatar_initials: true } }),
    prisma.task.count({ where: { status: { in: ["open", "in_progress"] } } }),
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

  const cards = allCards
    .filter((x) => activeFilter === "alla" || (activeFilter === "aktiva" ? x.c.status === "active" : x.needsAction))
    .filter((x) => !activeSearch || x.c.client_name.toLowerCase().includes(activeSearch.toLowerCase()))
    .filter((x) => !activeMarket || x.c.market === activeMarket)
    .filter((x) => !activeHealth || healthLevel(x.c.health_score) === activeHealth);

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

  function filterHref(f: FilterType): string {
    if (f === "alla") return "/dashboard";
    return `/dashboard?filter=${f}`;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F4F5] text-zinc-900" style={{ fontSize: 13 }}>

      {/* SIDEBAR — match 01-dashboard.html */}
      <aside className="flex w-[200px] min-w-[200px] shrink-0 flex-col bg-[#18181B]">
        <div className="border-b border-white/[0.07] px-4 pb-3 pt-[18px]">
          <p className="text-[11px] font-medium leading-tight text-white">Project Management -</p>
          <p className="mt-[1px] text-[10px] leading-tight text-white/35">Outbound</p>
        </div>
        <nav className="flex-1 space-y-[2px] px-2 py-[12px]">
          {[
            { label: "▦ Dashboard", href: "/dashboard", active: true, badge: null as number | null },
            { label: "◈ Kampanjer", href: "/dashboard", active: false, badge: campaigns.length },
            { label: "✓ Mina todos", href: "/todos", active: false, badge: openTodoCount },
            { label: "↗ Rapporter", href: "/rapporter", active: false, badge: null },
            { label: "≡ Checklistor", href: "/checklistor", active: false, badge: null },
            { label: "⚙ ICP-bibliotek", href: "/icp", active: false, badge: null },
          ].map(({ label, href, active, badge }) => (
            <Link
              key={label}
              href={href}
              className={`flex cursor-pointer items-center gap-2 rounded-[6px] px-[10px] py-2 text-[12px] leading-tight ${
                active ? "bg-[rgba(29,158,117,0.2)] text-[#3ECFA0]" : "text-white/45 hover:text-white/60"
              }`}
            >
              {label}
              {badge !== null && (
                <span className="ml-auto rounded-[10px] bg-[rgba(226,75,74,0.25)] px-[6px] py-[1px] text-[10px] text-[#F09595]">
                  {badge}
                </span>
              )}
            </Link>
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

        {/* TOPBAR — 01-dashboard.html (endast tre filterknappar) */}
        <header className="flex h-[50px] shrink-0 items-center justify-between border-b border-[#E4E4E7] bg-white px-5">
          <div>
            <p className="text-[14px] font-medium leading-tight text-[#18181B]">Kampanjöversikt</p>
            <p className="mt-[1px] text-[11px] leading-tight text-[#71717A]">{dateLabel}</p>
          </div>
          <div className="flex gap-[6px]">
            {(
              [
                { id: "alla" as const, label: "Alla" },
                { id: "aktiva" as const, label: "Aktiva" },
                { id: "atgard" as const, label: "⚠ Kräver åtgärd" },
              ] as const
            ).map(({ id, label }) => {
              const on = activeFilter === id;
              return (
                <Link
                  key={id}
                  href={filterHref(id)}
                  className={`cursor-pointer rounded-[6px] border px-[10px] py-[5px] text-[11px] leading-tight ${
                    on
                      ? "border-[#1D9E75] bg-[rgba(29,158,117,0.07)] text-[#1D9E75]"
                      : "border-[#E4E4E7] bg-[#F4F4F5] text-[#71717A] hover:border-[#D4D4D8]"
                  }`}
                >
                  {label}
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
            <div key={label} className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[10px]">
              <p className="text-[10px] uppercase leading-tight tracking-[0.4px] text-[#71717A]">{label}</p>
              <p className={`mt-1 text-[20px] font-medium leading-tight ${valCls ?? "text-[#18181B]"}`}>{val}</p>
              <p className={`mt-[3px] text-[10px] leading-tight ${subCls}`}>{sub}</p>
            </div>
          ))}
        </div>

        {/* CAMPAIGN GRID */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <p className="mb-[10px] pt-1 text-[11px] font-medium uppercase tracking-[0.5px] text-[#71717A]">
            Aktiva kampanjer
            {(activeSearch || activeMarket || activeHealth) && (
              <span className="ml-1 font-normal normal-case text-zinc-400">· filtrerat</span>
            )}
          </p>
          <div className="grid max-lg:grid-cols-2 grid-cols-3 gap-[10px]">
            {cards.map(({ c, thisWeek, overdueHighPrio }) => {
              const weekPct = c.weekly_meeting_target > 0 ? Math.min(100, Math.round((thisWeek / c.weekly_meeting_target) * 100)) : 0;
              const mtdPct = c.monthly_meeting_target > 0
                ? Math.min(100, Math.round((c.meetings_booked_mtd / c.monthly_meeting_target) * 100))
                : 0;
              const hl = healthLevel(c.health_score);
              // Real warning count: overdue high-prio tasks + activity gap + unsent report
              const overdueHigh = overdueHighPrio;
              const hasActivityGap = (() => {
                let gaps = 0;
                for (let i = 1; i <= 5; i++) {
                  const d = new Date(today);
                  d.setDate(d.getDate() - i);
                  const dow = d.getDay();
                  if (dow === 0 || dow === 6) continue; // skip weekends
                  const hasLog = c.activity_logs.some(
                    (l) => new Date(l.date).toDateString() === d.toDateString()
                  );
                  if (!hasLog) gaps++;
                  if (gaps >= 2) return true;
                }
                return false;
              })();
              const reportMissing = c.status === "active" &&
                !c.weekly_reports.some((r) => r.status === "sent");
              const warningCount = overdueHigh + (hasActivityGap ? 1 : 0) + (reportMissing ? 1 : 0);
              const daysLeft = daysToTuesday(today);
              return (
                <div
                  key={c.campaign_id}
                  className="rounded-[10px] border border-[#E4E4E7] bg-white p-[14px] transition-colors hover:border-[#A1A1AA]"
                >
                  <Link href={`/dashboard/${c.campaign_id}`} className="block cursor-pointer">
                    {/* ROW 1: name + health dot */}
                    <div className="flex items-start justify-between mb-[10px]">
                      <div>
                        <p className="text-[13px] font-medium text-[#18181B] leading-tight">{c.client_name}</p>
                        <p className="text-[10px] text-zinc-400 leading-tight mt-[2px]">{c.market.replace(/\//g, " · ")}</p>
                      </div>
                      <span className={`mt-[3px] h-[8px] w-[8px] shrink-0 rounded-full ${healthCls(hl)}`} />
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
                        <div className="mt-[4px] h-[3px] w-full overflow-hidden rounded-[2px] bg-[#E4E4E7]">
                          <div className={`h-full rounded-[2px] ${barCls(weekPct)}`} style={{ width: `${weekPct}%` }} />
                        </div>
                      </div>

                      <div className="rounded-[6px] bg-[#F4F4F5] px-[9px] py-[7px]">
                        <p className="text-[9px] text-zinc-500 leading-tight mb-[2px]">MTD-möten</p>
                        <p className="text-[14px] font-medium text-[#18181B] leading-tight">{c.meetings_booked_mtd}</p>
                        <p className="text-[9px] text-zinc-500 leading-tight mt-[1px]">mål: {c.monthly_meeting_target}</p>
                        <div className="mt-[4px] h-[3px] w-full overflow-hidden rounded-[2px] bg-[#E4E4E7]">
                          <div className={`h-full rounded-[2px] ${barCls(mtdPct)}`} style={{ width: `${mtdPct}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* ROW 4: footer */}
                    <div className="flex items-center justify-between border-t border-[#F4F4F5] pt-[9px]">
                      {daysLeft === 0 ? (
                        <p className="text-[10px] text-[#71717A]">
                          Rapport <span className="font-medium text-[#EF9F27]">idag</span>
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#71717A]">
                          Rapport om{" "}
                          <span className="font-medium text-[#EF9F27]">
                            {daysLeft} {daysLeft === 1 ? "dag" : "dagar"}
                          </span>
                        </p>
                      )}
                      {hl === "green" ? (
                        <span className={`shrink-0 rounded-[10px] px-[7px] py-[2px] text-[9px] font-medium leading-tight ${STATUS_CLS[c.status]}`}>
                          {STATUS_LABELS[c.status]}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-[10px] bg-[rgba(226,75,74,0.1)] px-[7px] py-[2px] text-[9px] font-medium leading-tight text-[#A32D2D]">
                          {warningCount > 0 ? `${warningCount} varningar` : "Kräver åtgärd"}
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
