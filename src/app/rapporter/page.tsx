import Link from "next/link";
import { prisma } from "@/lib/prisma";

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

function daysToTuesday(date: Date): number {
  const raw = (2 - date.getDay() + 7) % 7;
  return raw === 0 ? 7 : raw;
}

function healthDotCls(score: number): string {
  if (score > 74) return "bg-[#1D9E75]";
  if (score > 39) return "bg-[#EF9F27]";
  return "bg-[#E24B4A]";
}

function fmtShortDate(d: Date | null): string {
  if (!d) return "–";
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

type WeekReport = {
  report_id: string;
  week_number: number;
  status: "draft" | "sent";
  sent_at: Date | null;
  meetings_week: number;
  meetings_mtd: number;
};

type CampaignRow = {
  campaign_id: string;
  client_name: string;
  market: string;
  health_score: number;
  meetings_booked_mtd: number;
  assigned_pm: { name: string };
  weekly_reports: WeekReport[];
};

function reportForWeek(c: CampaignRow, week: number): WeekReport | undefined {
  return c.weekly_reports.find((r) => r.week_number === week);
}

function latestSentAt(c: CampaignRow): Date | null {
  const sent = c.weekly_reports.filter((r) => r.status === "sent" && r.sent_at);
  if (sent.length === 0) return null;
  return sent.reduce((max, r) => {
    const t = r.sent_at!.getTime();
    return t > max.getTime() ? r.sent_at! : max;
  }, sent[0]!.sent_at!);
}

export default async function RapporterPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const currentWeek = isoWeek(today);
  const daysLeft = daysToTuesday(today);

  const [pm, campaigns] = await Promise.all([
    prisma.user.findFirst({ where: { role: "pm" }, select: { name: true, avatar_initials: true } }),
    prisma.campaign.findMany({
      where: { status: { in: ["active", "closing"] } },
      select: {
        campaign_id: true,
        client_name: true,
        market: true,
        health_score: true,
        meetings_booked_mtd: true,
        assigned_pm: { select: { name: true } },
        weekly_reports: {
          where: { year: currentYear },
          orderBy: { week_number: "desc" },
          take: 4,
          select: {
            report_id: true,
            week_number: true,
            status: true,
            sent_at: true,
            meetings_week: true,
            meetings_mtd: true,
          },
        },
      },
      orderBy: { client_name: "asc" },
    }),
  ]);

  const rows = campaigns as unknown as CampaignRow[];

  const totalCampaigns = rows.length;
  const sentThisWeek = rows.filter((c) =>
    c.weekly_reports.some((r) => r.week_number === currentWeek && r.status === "sent")
  ).length;
  const draftThisWeek = rows.filter((c) =>
    c.weekly_reports.some((r) => r.week_number === currentWeek && r.status === "draft")
  ).length;
  const notStarted = totalCampaigns - sentThisWeek - draftThisWeek;

  const historyWeeks = [currentWeek - 1, currentWeek - 2, currentWeek - 3].filter((w) => w > 0);

  const deadlineDagar = daysLeft === 1 ? "dag" : "dagar";

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F4F5] text-zinc-900" style={{ fontSize: 13 }}>
      <aside className="flex w-[200px] min-w-[200px] shrink-0 flex-col bg-[#18181B]">
        <div className="border-b border-white/[0.07] px-4 py-3">
          <p className="text-[11px] font-medium leading-tight text-white">Project Management -</p>
          <p className="mt-[1px] text-[10px] leading-tight text-white/35">Outbound</p>
        </div>
        <nav className="flex-1 space-y-[2px] px-2 py-3">
          {[
            { label: "▦ Dashboard", href: "/dashboard", active: false },
            { label: "◈ Kampanjer", href: "/dashboard", active: false },
            { label: "✓ Mina todos", href: "/todos", active: false },
            { label: "↗ Rapporter", href: "/rapporter", active: true },
            { label: "≡ Checklistor", href: "/checklistor", active: false },
            { label: "⚙ ICP-bibliotek", href: "/icp", active: false },
          ].map(({ label, href, active }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-2 rounded-[6px] px-[10px] py-2 text-[12px] leading-tight ${
                active
                  ? "bg-[rgba(55,138,221,0.2)] text-[#378ADD]"
                  : "text-white/45 hover:text-white/70"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-white/[0.07] px-[14px] py-3">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-[10px] font-medium text-white">
            {pm?.avatar_initials ?? "PM"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] leading-tight text-white/60">{pm?.name ?? "Project Manager"}</p>
            <p className="mt-[1px] text-[10px] leading-tight text-white/30">Project Manager</p>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-[#E4E4E7] bg-white px-[18px] py-[13px]">
          <div>
            <p className="text-[15px] font-medium text-[#18181B]">Rapporter</p>
            <p className="text-[11px] text-[#71717A]">
              {sentThisWeek}/{totalCampaigns} skickade denna vecka · Deadline om {daysLeft} {deadlineDagar}
            </p>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-[12px] overflow-y-auto px-5 py-4">
          <div className="mb-[4px] grid grid-cols-3 gap-[10px]">
            <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[10px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-[#71717A]">
                Skickade v.{currentWeek}
              </p>
              <p className="mt-1 text-[20px] font-medium text-[#1D9E75]">{sentThisWeek}</p>
              <p className="mt-[3px] text-[10px] text-[#71717A]">{totalCampaigns} kampanjer totalt</p>
            </div>
            <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[10px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Utkast klara</p>
              <p className="mt-1 text-[20px] font-medium text-[#EF9F27]">{draftThisWeek}</p>
              <p className="mt-[3px] text-[10px] text-[#71717A]">Klicka Skicka för att slutföra</p>
            </div>
            <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[10px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Ej påbörjade</p>
              <p
                className={`mt-1 text-[20px] font-medium ${
                  notStarted > 0 ? "text-[#E24B4A]" : "text-[#18181B]"
                }`}
              >
                {notStarted}
              </p>
              <p className="mt-[3px] text-[10px] text-[#71717A]">Deadline: tisdag EOD</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-[0.5px] text-[#71717A]">
              ALLA AKTIVA KAMPANJER · v.{currentWeek}
            </p>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white text-[12px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                  {[
                    "Kampanj",
                    "Marknad",
                    "PM",
                    `v.${currentWeek} status`,
                    "Möten v.",
                    "MTD",
                    "Senast skickad",
                    "Åtgärd",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-[7px] text-left text-[9px] font-medium uppercase tracking-[0.4px] text-[#71717A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c, idx) => {
                  const wr = reportForWeek(c, currentWeek);
                  const status: "sent" | "draft" | "none" = wr?.status === "sent" ? "sent" : wr?.status === "draft" ? "draft" : "none";
                  const lastSent = latestSentAt(c);
                  const isLast = idx === rows.length - 1;
                  return (
                    <tr key={c.campaign_id} className={isLast ? "" : "border-b border-[#F4F4F5]"}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${healthDotCls(c.health_score)}`} />
                          <Link
                            href={`/dashboard/${c.campaign_id}?tab=rapporter`}
                            className="text-[12px] font-medium text-[#18181B] hover:underline"
                          >
                            {c.client_name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-[#71717A]">{c.market}</td>
                      <td className="px-3 py-2 text-[11px] text-[#71717A]">{c.assigned_pm.name}</td>
                      <td className="px-3 py-2">
                        {status === "sent" && (
                          <span className="rounded-[10px] bg-[rgba(29,158,117,0.1)] px-[7px] py-[2px] text-[10px] text-[#0F6E56]">
                            Skickad
                          </span>
                        )}
                        {status === "draft" && (
                          <span className="rounded-[10px] bg-[rgba(239,159,39,0.12)] px-[7px] py-[2px] text-[10px] text-[#854F0B]">
                            Utkast
                          </span>
                        )}
                        {status === "none" && (
                          <span className="rounded-[10px] bg-[rgba(226,75,74,0.08)] px-[7px] py-[2px] text-[10px] text-[#A32D2D]">
                            Ej påbörjad
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[#71717A]">{wr ? wr.meetings_week : "–"}</td>
                      <td className="px-3 py-2 text-[#71717A]">{wr ? wr.meetings_mtd : c.meetings_booked_mtd}</td>
                      <td className="px-3 py-2 text-[#71717A]">{fmtShortDate(lastSent)}</td>
                      <td className="px-3 py-2">
                        {status === "sent" && <span className="text-[11px] text-[#1D9E75]">✓</span>}
                        {status === "draft" && (
                          <Link
                            href={`/dashboard/${c.campaign_id}?tab=rapporter`}
                            className="inline-block rounded-[5px] border border-[#0F6E56] bg-[#0F6E56] px-2 py-[3px] text-[10px] text-white"
                          >
                            Skicka →
                          </Link>
                        )}
                        {status === "none" && (
                          <Link
                            href={`/dashboard/${c.campaign_id}?tab=rapporter`}
                            className="inline-block rounded-[5px] border border-[#E4E4E7] bg-white px-2 py-[3px] text-[10px] text-[#71717A]"
                          >
                            Generera
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.5px] text-[#71717A]">
            HISTORIK (SENASTE 4 VECKOR)
          </p>

          <div className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white text-[12px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                  {["Kampanj", "Marknad", "PM", "Status", "Möten v.", "MTD", "Skickad"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-[7px] text-left text-[9px] font-medium uppercase tracking-[0.4px] text-[#71717A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyWeeks.map((weekNum) => (
                  <tbody key={weekNum}>
                    <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                      <td colSpan={7} className="px-3 py-2 text-[11px] font-medium text-[#18181B]">
                        Vecka {weekNum}
                      </td>
                    </tr>
                    {rows.map((c, idx) => {
                      const wr = reportForWeek(c, weekNum);
                      const status: "sent" | "draft" | "none" = wr?.status === "sent" ? "sent" : wr?.status === "draft" ? "draft" : "none";
                      const isLastWeek = weekNum === historyWeeks[historyWeeks.length - 1];
                      const isLastRow = isLastWeek && idx === rows.length - 1;
                      return (
                        <tr
                          key={`${c.campaign_id}-${weekNum}`}
                          className={isLastRow ? "" : "border-b border-[#F4F4F5]"}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${healthDotCls(c.health_score)}`} />
                              <Link
                                href={`/dashboard/${c.campaign_id}?tab=rapporter`}
                                className="text-[12px] font-medium text-[#18181B] hover:underline"
                              >
                                {c.client_name}
                              </Link>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-[11px] text-[#71717A]">{c.market}</td>
                          <td className="px-3 py-2 text-[11px] text-[#71717A]">{c.assigned_pm.name}</td>
                          <td className="px-3 py-2">
                            {status === "sent" && (
                              <span className="rounded-[10px] bg-[rgba(29,158,117,0.1)] px-[7px] py-[2px] text-[10px] text-[#0F6E56]">
                                Skickad
                              </span>
                            )}
                            {status === "draft" && (
                              <span className="rounded-[10px] bg-[rgba(239,159,39,0.12)] px-[7px] py-[2px] text-[10px] text-[#854F0B]">
                                Utkast
                              </span>
                            )}
                            {status === "none" && (
                              <span className="rounded-[10px] bg-[rgba(226,75,74,0.08)] px-[7px] py-[2px] text-[10px] text-[#A32D2D]">
                                Ej påbörjad
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[#71717A]">{wr ? wr.meetings_week : "–"}</td>
                          <td className="px-3 py-2 text-[#71717A]">{wr ? wr.meetings_mtd : "–"}</td>
                          <td className="px-3 py-2 text-[#71717A]">
                            {wr?.status === "sent" && wr.sent_at ? fmtShortDate(wr.sent_at) : "–"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
