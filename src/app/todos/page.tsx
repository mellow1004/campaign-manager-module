import Link from "next/link";
import { TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const CAMPAIGN_TAG_STYLES = [
  "bg-[rgba(55,138,221,0.1)] text-[#185FA5]",
  "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]",
  "bg-[rgba(239,159,39,0.12)] text-[#854F0B]",
  "bg-[rgba(83,74,183,0.1)] text-[#534AB7]",
  "bg-[rgba(226,75,74,0.1)] text-[#A32D2D]",
] as const;

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

function getPriorityDot(priority: TaskPriority): string {
  return priority === "high" ? "bg-[#E24B4A]" : priority === "medium" ? "bg-[#EF9F27]" : "bg-[#97C459]";
}

function dueOverdueLabel(taskDate: Date, today: Date): string {
  const days = Math.max(1, Math.round((today.getTime() - taskDate.getTime()) / 86400000));
  return `${days} dag${days === 1 ? "" : "ar"} sen`;
}

function fmtHeaderDate(date: Date): string {
  const dayNames = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
  const monthNames = [
    "januari",
    "februari",
    "mars",
    "april",
    "maj",
    "juni",
    "juli",
    "augusti",
    "september",
    "oktober",
    "november",
    "december",
  ];
  return `${dayNames[date.getDay()] ?? ""} ${date.getDate()} ${monthNames[date.getMonth()] ?? ""}`;
}

export default async function TodosPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const currentWeek = isoWeek(today);
  const currentYear = today.getFullYear();

  const [pm, tasks, campaigns, checklistInstances] = await Promise.all([
    prisma.user.findFirst({ where: { role: "pm" }, select: { name: true, avatar_initials: true } }),
    prisma.task.findMany({
      where: { status: { in: ["open", "in_progress"] } },
      include: {
        campaign: { select: { campaign_id: true, client_name: true, health_score: true } },
      },
      orderBy: [{ due_date: "asc" }, { priority: "asc" }],
    }),
    prisma.campaign.findMany({
      where: { status: { in: ["active", "closing"] } },
      select: {
        campaign_id: true,
        client_name: true,
        health_score: true,
        weekly_reports: {
          where: { week_number: currentWeek, year: currentYear },
          select: { report_id: true, week_number: true, status: true },
          take: 1,
        },
      },
      orderBy: { client_name: "asc" },
    }),
    prisma.checklistInstance.findMany({
      where: { completion_pct: { lt: 100 } },
      include: {
        campaign: { select: { campaign_id: true, client_name: true, health_score: true } },
        template: { select: { name: true, type: true } },
      },
      orderBy: { created_at: "asc" },
      take: 20,
    }),
  ]);

  const openCount = tasks.length;
  const overdue = tasks.filter((t) => t.due_date < today);
  const dueToday = tasks.filter((t) => {
    const d = new Date(t.due_date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  const reportsToSend = campaigns.map((campaign) => ({
    campaign,
    report: campaign.weekly_reports[0] ?? null,
  }));

  const checklistsToStart = checklistInstances.filter((inst) => inst.completion_pct < 100);

  const campaignMap = new Map<string, { campaign_id: string; client_name: string; health_score: number }>();
  for (const c of campaigns) campaignMap.set(c.campaign_id, c);
  for (const t of tasks) {
    if (t.campaign) campaignMap.set(t.campaign.campaign_id, t.campaign);
  }
  for (const inst of checklistsToStart) campaignMap.set(inst.campaign.campaign_id, inst.campaign);
  const orderedCampaigns = Array.from(campaignMap.values()).sort((a, b) => a.client_name.localeCompare(b.client_name));
  const campaignColor = new Map<string, string>();
  for (const [idx, c] of orderedCampaigns.entries()) {
    campaignColor.set(c.campaign_id, CAMPAIGN_TAG_STYLES[idx % CAMPAIGN_TAG_STYLES.length] ?? CAMPAIGN_TAG_STYLES[0]);
  }

  const campaignTagClass = (campaignId: string): string =>
    campaignColor.get(campaignId) ?? "bg-[rgba(55,138,221,0.1)] text-[#185FA5]";

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F4F5] text-zinc-900" style={{ fontSize: 13 }}>
      <aside className="flex w-[200px] min-w-[200px] shrink-0 flex-col bg-[#18181B]">
        <div className="border-b border-white/[0.07] px-4 py-3">
          <p className="text-[15px] font-medium text-white leading-tight">Otto</p>
          <p className="mt-[1px] text-[10px] text-white/35">CoSeller Suite</p>
        </div>
        <nav className="flex-1 space-y-[2px] px-2 py-3">
          {[
            { label: "▦ Dashboard", href: "/dashboard", active: false },
            { label: "◈ Kampanjer", href: "/dashboard", active: false },
            { label: "✓ Mina todos", href: "/todos", active: true },
            { label: "↗ Rapporter", href: "#", active: false },
            { label: "≡ Checklistor", href: "#", active: false },
            { label: "⚙ ICP-bibliotek", href: "#", active: false },
          ].map(({ label, href, active }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-2 rounded-[6px] px-[10px] py-2 text-[12px] leading-tight ${
                active ? "bg-[rgba(29,158,117,0.2)] text-[#3ECFA0]" : "text-white/45 hover:text-white/70"
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
            <p className="mt-[1px] text-[10px] text-white/30">Project Manager</p>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-[#E4E4E7] bg-white px-[18px] py-[13px]">
          <div>
            <p className="text-[15px] font-medium text-[#18181B]">Mina todos</p>
            <p className="text-[11px] text-[#71717A]">{fmtHeaderDate(today)} · {openCount} öppna uppgifter</p>
          </div>
          <div className="flex gap-[3px] rounded-[6px] border border-[#E4E4E7] bg-[#F4F4F5] p-[3px]">
            <Link
              href="/todos"
              className="rounded-[4px] border border-[#E4E4E7] bg-white px-[10px] py-[4px] text-[11px] text-[#18181B]"
            >
              Dagslista
            </Link>
            <Link href="/todos/columns" className="px-[10px] py-[4px] text-[11px] text-[#71717A]">
              Kampanjkolumner
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-[20px] py-[16px]">
          <div className="flex flex-col gap-[12px]">
            {overdue.length > 0 && (
              <section className="overflow-hidden rounded-[8px] border border-[rgba(226,75,74,0.25)] bg-white">
                <div className="flex items-center gap-[7px] border-b border-[#F4F4F5] bg-[#FAFAFA] px-[13px] py-[8px]">
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[3px] bg-[rgba(226,75,74,0.1)] text-[10px] text-[#A32D2D]">!</span>
                  <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Försenade</p>
                  <span className="ml-auto text-[10px] text-[#71717A]">{overdue.length}</span>
                </div>
                {overdue.map((task) => (
                  <div
                    key={task.task_id}
                    className="flex cursor-pointer items-center gap-[10px] border-b border-[#F4F4F5] px-[13px] py-[9px] hover:bg-[#FAFAFA]"
                  >
                    <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${getPriorityDot(task.priority)}`} />
                    <span className="h-[15px] w-[15px] shrink-0 rounded-[3px] border border-[#D4D4D8] bg-white" />
                    <p className="flex-1 text-[12px] leading-[1.3] text-[#18181B]">{task.title}</p>
                    {task.campaign && (
                      <span className={`rounded-[10px] px-[8px] py-[2px] text-[10px] font-medium ${campaignTagClass(task.campaign.campaign_id)}`}>
                        {task.campaign.client_name}
                      </span>
                    )}
                    <span className="text-[10px] text-[#A32D2D]">{dueOverdueLabel(task.due_date, today)}</span>
                  </div>
                ))}
              </section>
            )}

            <section className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
              <div className="flex items-center gap-[7px] border-b border-[#F4F4F5] bg-[#FAFAFA] px-[13px] py-[8px]">
                <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[3px] bg-[rgba(55,138,221,0.08)] text-[10px] text-[#185FA5]">✦</span>
                <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Idag</p>
                <span className="ml-auto text-[10px] text-[#71717A]">{dueToday.length}</span>
              </div>
              {dueToday.length === 0 ? (
                <p className="px-[13px] py-[9px] text-[12px] text-[#71717A]">Inga uppgifter för idag.</p>
              ) : (
                dueToday.map((task) => (
                  <div
                    key={task.task_id}
                    className="flex cursor-pointer items-center gap-[10px] border-b border-[#F4F4F5] px-[13px] py-[9px] hover:bg-[#FAFAFA]"
                  >
                    <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${getPriorityDot(task.priority)}`} />
                    <span className="h-[15px] w-[15px] shrink-0 rounded-[3px] border border-[#D4D4D8] bg-white" />
                    <p className="flex-1 text-[12px] leading-[1.3] text-[#18181B]">{task.title}</p>
                    {task.campaign && (
                      <span className={`rounded-[10px] px-[8px] py-[2px] text-[10px] font-medium ${campaignTagClass(task.campaign.campaign_id)}`}>
                        {task.campaign.client_name}
                      </span>
                    )}
                    <span className="text-[10px] text-[#854F0B]">Idag</span>
                  </div>
                ))
              )}
            </section>

            <section className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
              <div className="flex items-center gap-[7px] border-b border-[#F4F4F5] bg-[#FAFAFA] px-[13px] py-[8px]">
                <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[3px] bg-[rgba(239,159,39,0.1)] text-[10px] text-[#854F0B]">▦</span>
                <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Rapporter att skicka denna vecka</p>
                <span className="ml-auto text-[10px] text-[#71717A]">{reportsToSend.length}</span>
              </div>
              {reportsToSend.map(({ campaign, report }) => (
                <div key={campaign.campaign_id} className="flex items-center gap-[10px] border-b border-[#F4F4F5] px-[13px] py-[8px]">
                  <span className={`rounded-[10px] px-[8px] py-[2px] text-[10px] font-medium ${campaignTagClass(campaign.campaign_id)}`}>
                    {campaign.client_name}
                  </span>
                  <p className="flex-1 text-[12px] text-[#18181B]">
                    Veckorapport v.{report?.week_number ?? currentWeek} · {report ? "utkast klart" : "ej påbörjad"}
                  </p>
                  <span className="text-[11px] text-[#854F0B]">Imorgon tis</span>
                  <Link
                    href={`/dashboard/${campaign.campaign_id}?tab=rapporter`}
                    className={
                      report
                        ? "rounded-[5px] bg-[#185FA5] px-[8px] py-[3px] text-[10px] text-white"
                        : "rounded-[5px] border border-[#E4E4E7] bg-white px-[8px] py-[3px] text-[10px] text-[#71717A]"
                    }
                  >
                    {report ? "Skicka" : "Generera"}
                  </Link>
                </div>
              ))}
            </section>

            {checklistsToStart.length > 0 && (
              <section className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
                <div className="flex items-center gap-[7px] border-b border-[#F4F4F5] bg-[#FAFAFA] px-[13px] py-[8px]">
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[3px] bg-[rgba(83,74,183,0.08)] text-[10px] text-[#534AB7]">≡</span>
                  <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Checklistor att starta</p>
                  <span className="ml-auto text-[10px] text-[#71717A]">{checklistsToStart.length}</span>
                </div>
                {checklistsToStart.map((inst) => (
                  <div key={inst.instance_id} className="flex items-center gap-[10px] border-b border-[#F4F4F5] px-[13px] py-[9px]">
                    <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#534AB7]" />
                    <span className="h-[15px] w-[15px] shrink-0 rounded-[3px] border border-[#D4D4D8] bg-white" />
                    <p className="flex-1 text-[12px] leading-[1.3] text-[#18181B]">
                      {inst.template.name}
                      {inst.week_number ? ` · v.${inst.week_number}` : ""}
                    </p>
                    <span className={`rounded-[10px] px-[8px] py-[2px] text-[10px] font-medium ${campaignTagClass(inst.campaign.campaign_id)}`}>
                      {inst.campaign.client_name}
                    </span>
                    <Link
                      href={`/dashboard/${inst.campaign.campaign_id}?tab=checklistor`}
                      className="rounded-[5px] bg-[#185FA5] px-[8px] py-[3px] text-[10px] text-white"
                    >
                      Öppna
                    </Link>
                  </div>
                ))}
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
