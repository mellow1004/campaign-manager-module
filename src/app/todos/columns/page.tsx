import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskPriority } from "@prisma/client";

const PRIORITY_CLS: Record<TaskPriority, string> = {
  high:   "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-zinc-100 text-zinc-600",
};
const PRIORITY_LABELS: Record<TaskPriority, string> = { high: "Hög", medium: "Medium", low: "Låg" };

function fmtShort(d: Date): string {
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

export default async function TodoColumnsPage() {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [pm, campaigns] = await Promise.all([
    prisma.user.findFirst({ where: { role: "pm" }, select: { name: true, avatar_initials: true } }),
    prisma.campaign.findMany({
      where: { status: { in: ["active", "onboarding", "closing"] } },
      select: {
        campaign_id: true,
        client_name: true,
        market: true,
        health_score: true,
        weekly_meeting_target: true,
        tasks: {
          where: { status: { in: ["open", "in_progress"] } },
          include: { assigned_to: { select: { name: true } } },
          orderBy: [{ due_date: "asc" }, { priority: "asc" }],
        },
        checklist_instances: {
          select: { instance_id: true, completion_pct: true, template: { select: { name: true } } },
          orderBy: { created_at: "desc" },
          take: 3,
        },
        activity_logs: {
          where: { date: { gte: (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; })() } },
          select: { meetings_booked: true },
        },
      },
      orderBy: { health_score: "asc" }, // worst health first
    }),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F4F5] text-zinc-900" style={{ fontSize: 13 }}>

      {/* SIDEBAR */}
      <aside className="flex w-[200px] min-w-[200px] shrink-0 flex-col bg-[#18181B]">
        <div className="border-b border-white/[0.07] px-4 py-3">
          <p className="text-[15px] font-medium text-white leading-tight">Otto</p>
          <p className="text-[10px] text-white/35 mt-[1px]">CoSeller Suite</p>
        </div>
        <nav className="flex-1 space-y-[2px] px-2 py-3">
          {[
            { label: "▦ Dashboard",    href: "/dashboard", active: false },
            { label: "◈ Kampanjer",    href: "/dashboard", active: false },
            { label: "✓ Mina todos",   href: "/todos",     active: true  },
            { label: "↗ Rapporter",    href: "#",          active: false },
            { label: "≡ Checklistor",  href: "#",          active: false },
            { label: "⚙ ICP-bibliotek",href: "#",          active: false },
          ].map(({ label, href, active }) => (
            <Link key={label} href={href}
              className={`flex items-center gap-2 rounded-[6px] px-[10px] py-2 text-[12px] leading-tight ${active ? "bg-[rgba(29,158,117,0.2)] text-[#3ECFA0]" : "text-white/45 hover:text-white/70"}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-white/[0.07] px-[14px] py-3">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-[10px] font-medium text-white">
            {pm?.avatar_initials ?? "PM"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] text-white/60 leading-tight">{pm?.name ?? "PM"}</p>
            <p className="text-[10px] text-white/30 mt-[1px]">Project Manager</p>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex flex-1 flex-col overflow-hidden">

        {/* TOPBAR */}
        <header className="flex h-[50px] shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5">
          <div>
            <p className="text-[14px] font-medium text-[#18181B] leading-tight">Mina todos – Kampanjvy</p>
            <p className="text-[11px] text-zinc-400 mt-[1px]">{campaigns.length} kampanjer visas</p>
          </div>
          <div className="flex gap-2">
            <Link href="/todos" className="rounded-[6px] border border-zinc-200 bg-[#F4F4F5] px-3 py-[5px] text-[11px] text-zinc-500 hover:border-zinc-300">
              Dagslista
            </Link>
            <Link href="/todos/columns" className="rounded-[6px] border border-[#1D9E75] bg-[rgba(29,158,117,0.07)] px-3 py-[5px] text-[11px] text-[#1D9E75]">
              Kampanjvy
            </Link>
          </div>
        </header>

        {/* COLUMN GRID — horizontally scrollable */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full gap-[10px] p-4" style={{ minWidth: campaigns.length * 260 + 32 }}>
            {campaigns.map((c) => {
              const hl = c.health_score < 40 ? "red" : c.health_score < 75 ? "yellow" : "green";
              const dotCls = hl === "green" ? "bg-[#1D9E75]" : hl === "yellow" ? "bg-[#EF9F27]" : "bg-[#E24B4A]";
              const weekMeetings = c.activity_logs.reduce((s, l) => s + l.meetings_booked, 0);
              const meetPct = c.weekly_meeting_target > 0
                ? Math.min(100, Math.round((weekMeetings / c.weekly_meeting_target) * 100))
                : 0;

              const overdueTasks = c.tasks.filter((t) => t.due_date < today);
              const todayTasks   = c.tasks.filter((t) => {
                const d = new Date(t.due_date); d.setHours(0,0,0,0);
                return d.getTime() === today.getTime();
              });
              const laterTasks   = c.tasks.filter((t) => t.due_date > today);

              return (
                <div key={c.campaign_id}
                  className="flex w-[248px] min-w-[248px] flex-col rounded-[10px] border border-zinc-200 bg-white overflow-hidden">

                  {/* Column header */}
                  <div className="border-b border-zinc-100 px-3 py-[10px]">
                    <div className="flex items-center gap-2 mb-[6px]">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls}`} />
                      <Link href={`/dashboard/${c.campaign_id}`}
                        className="text-[13px] font-semibold text-zinc-900 hover:text-[#1D9E75] leading-tight truncate">
                        {c.client_name}
                      </Link>
                    </div>
                    <p className="text-[10px] text-zinc-400 mb-[8px]">{c.market.replace(/\//g, " · ")}</p>
                    {/* Mini meeting progress */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-[3px] rounded-full bg-zinc-100">
                        <div className={`h-full rounded-full ${meetPct < 40 ? "bg-[#E24B4A]" : meetPct < 75 ? "bg-[#EF9F27]" : "bg-[#1D9E75]"}`}
                          style={{ width: `${meetPct}%` }} />
                      </div>
                      <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                        {weekMeetings}/{c.weekly_meeting_target} möten
                      </span>
                    </div>
                  </div>

                  {/* Tasks — scrollable body */}
                  <div className="flex-1 overflow-y-auto px-2 py-2 space-y-[2px]">

                    {/* Overdue */}
                    {overdueTasks.length > 0 && (
                      <>
                        <p className="px-1 py-[3px] text-[9px] font-semibold uppercase tracking-[0.5px] text-[#E24B4A]">
                          Försenade ({overdueTasks.length})
                        </p>
                        {overdueTasks.map((t) => <TaskCard key={t.task_id} task={t} today={today} />)}
                      </>
                    )}

                    {/* Today */}
                    {todayTasks.length > 0 && (
                      <>
                        <p className="px-1 py-[3px] text-[9px] font-semibold uppercase tracking-[0.5px] text-[#EF9F27]">
                          Idag
                        </p>
                        {todayTasks.map((t) => <TaskCard key={t.task_id} task={t} today={today} />)}
                      </>
                    )}

                    {/* Upcoming */}
                    {laterTasks.length > 0 && (
                      <>
                        <p className="px-1 py-[3px] text-[9px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
                          Kommande
                        </p>
                        {laterTasks.slice(0, 5).map((t) => <TaskCard key={t.task_id} task={t} today={today} />)}
                        {laterTasks.length > 5 && (
                          <p className="px-1 text-[9px] text-zinc-400">+{laterTasks.length - 5} fler</p>
                        )}
                      </>
                    )}

                    {c.tasks.length === 0 && (
                      <p className="px-1 py-2 text-[11px] text-zinc-400">Inga öppna tasks</p>
                    )}
                  </div>

                  {/* Checklist progress footer */}
                  {c.checklist_instances.length > 0 && (
                    <div className="border-t border-zinc-100 px-3 py-[8px] space-y-[5px]">
                      {c.checklist_instances.map((inst) => (
                        <div key={inst.instance_id} className="flex items-center gap-2">
                          <div className={`h-[10px] w-[10px] shrink-0 rounded-full border-2 flex items-center justify-center ${inst.completion_pct === 100 ? "bg-[#1D9E75] border-[#1D9E75]" : "border-zinc-300"}`}>
                            {inst.completion_pct === 100 && <span className="text-white text-[6px]">✓</span>}
                          </div>
                          <p className={`flex-1 text-[10px] truncate ${inst.completion_pct === 100 ? "line-through text-zinc-400" : "text-zinc-600"}`}>
                            {inst.template.name}
                          </p>
                          <span className="text-[9px] text-zinc-400">{inst.completion_pct}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add task link */}
                  <div className="border-t border-zinc-100 px-3 py-[7px]">
                    <Link href={`/dashboard/${c.campaign_id}?tab=tasks`}
                      className="text-[11px] text-zinc-400 hover:text-[#1D9E75]">
                      + Ny task
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Mini task card ───────────────────────────────────────────────────────────

type TaskRow = {
  task_id: string; title: string; due_date: Date; priority: TaskPriority;
  status: string; assigned_to: { name: string };
};

function TaskCard({ task, today }: { task: TaskRow; today: Date }) {
  const isOverdue = task.due_date < today;
  const daysOff = Math.round((task.due_date.getTime() - today.getTime()) / 86400000);
  return (
    <div className="rounded-[5px] border border-zinc-100 bg-[#F8F8F8] px-[8px] py-[6px] hover:border-zinc-200">
      <p className="text-[11px] font-medium text-zinc-900 leading-tight line-clamp-2 mb-[4px]">{task.title}</p>
      <div className="flex items-center gap-1 flex-wrap">
        <span className={`rounded-[3px] px-[4px] py-[1px] text-[9px] font-medium ${PRIORITY_CLS[task.priority]}`}>
          {PRIORITY_LABELS[task.priority]}
        </span>
        <span className={`text-[9px] ml-auto ${isOverdue ? "text-[#E24B4A] font-medium" : daysOff === 0 ? "text-[#EF9F27]" : "text-zinc-400"}`}>
          {isOverdue ? `${Math.abs(daysOff)}d sen` : daysOff === 0 ? "idag" : fmtShort(task.due_date)}
        </span>
      </div>
    </div>
  );
}
