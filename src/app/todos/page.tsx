import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskPriority, TaskStatus } from "@prisma/client";

const PRIORITY_CLS: Record<TaskPriority, string> = {
  high:   "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-zinc-100 text-zinc-600",
};
const PRIORITY_LABELS: Record<TaskPriority, string> = { high: "Hög", medium: "Medium", low: "Låg" };
const STATUS_CLS: Record<TaskStatus, string> = {
  open:        "bg-zinc-100 text-zinc-500",
  in_progress: "bg-amber-50 text-amber-700",
  done:        "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]",
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

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

export default async function TodosPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const [pm, tasks, campaigns, checklistInstances] = await Promise.all([
    prisma.user.findFirst({ where: { role: "pm" }, select: { name: true, avatar_initials: true, user_id: true } }),
    prisma.task.findMany({
      where: { status: { in: ["open", "in_progress"] } },
      include: {
        campaign: { select: { campaign_id: true, client_name: true, health_score: true } },
        assigned_to: { select: { name: true } },
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
          where: { status: "draft" },
          select: { report_id: true, week_number: true },
          take: 1,
          orderBy: { week_number: "desc" },
        },
      },
    }),
    prisma.checklistInstance.findMany({
      where: { completion_pct: { lt: 100 } },
      include: {
        campaign:  { select: { campaign_id: true, client_name: true } },
        template:  { select: { name: true, type: true } },
      },
      orderBy: { created_at: "asc" },
      take: 20,
    }),
  ]);

  const overdue  = tasks.filter((t) => t.due_date < today);
  const dueToday = tasks.filter((t) => {
    const d = new Date(t.due_date); d.setHours(0,0,0,0);
    return d.getTime() === today.getTime();
  });
  const upcoming = tasks.filter((t) => t.due_date >= tomorrow);

  const reportsToSend = campaigns.filter((c) => c.weekly_reports.length > 0);
  const daysLeft = daysToTuesday(today);

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
            <p className="truncate text-[11px] text-white/60 leading-tight">{pm?.name ?? "Project Manager"}</p>
            <p className="text-[10px] text-white/30 mt-[1px]">Project Manager</p>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex flex-1 flex-col overflow-hidden">

        {/* TOPBAR */}
        <header className="flex h-[50px] shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5">
          <div>
            <p className="text-[14px] font-medium text-[#18181B] leading-tight">Mina todos</p>
            <p className="text-[11px] text-zinc-400 mt-[1px]">
              {overdue.length > 0 && <span className="text-[#E24B4A] font-medium">{overdue.length} försenade · </span>}
              {dueToday.length} idag · rapport deadline om {daysLeft} dagar
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/todos" className="rounded-[6px] border border-[#1D9E75] bg-[rgba(29,158,117,0.07)] px-3 py-[5px] text-[11px] text-[#1D9E75]">
              Dagslista
            </Link>
            <Link href="/todos/columns" className="rounded-[6px] border border-zinc-200 bg-[#F4F4F5] px-3 py-[5px] text-[11px] text-zinc-500 hover:border-zinc-300">
              Kampanjvy
            </Link>
          </div>
        </header>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* ── FÖRSENADE ── */}
          {overdue.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#E24B4A]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#E24B4A]">
                  Försenade ({overdue.length})
                </p>
              </div>
              <div className="rounded-[8px] border border-rose-200 bg-white overflow-hidden">
                {overdue.map((task, i) => (
                  <TaskRow key={task.task_id} task={task} today={today} isOverdue stripe={i % 2 === 1} />
                ))}
              </div>
            </section>
          )}

          {/* ── IDAG ── */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#EF9F27]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-600">
                Idag {dueToday.length > 0 ? `(${dueToday.length})` : ""}
              </p>
            </div>
            <div className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
              {dueToday.length === 0 ? (
                <p className="px-4 py-3 text-[12px] text-zinc-400">Inga tasks förfaller idag.</p>
              ) : (
                dueToday.map((task, i) => (
                  <TaskRow key={task.task_id} task={task} today={today} isOverdue={false} stripe={i % 2 === 1} />
                ))
              )}
            </div>
          </section>

          {/* ── RAPPORTER ── */}
          {reportsToSend.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#EF9F27]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-600">
                  Rapporter att skicka ({reportsToSend.length}) · deadline om {daysLeft} dagar
                </p>
              </div>
              <div className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
                {reportsToSend.map((c, i) => (
                  <div key={c.campaign_id} className={`flex items-center gap-3 px-4 py-[9px] border-b border-zinc-50 last:border-0 ${i % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}>
                    <div className={`h-2 w-2 shrink-0 rounded-full ${c.health_score < 40 ? "bg-[#E24B4A]" : c.health_score < 75 ? "bg-[#EF9F27]" : "bg-[#1D9E75]"}`} />
                    <p className="flex-1 text-[12px] font-medium text-zinc-900">{c.client_name}</p>
                    <span className="text-[10px] text-zinc-400">
                      v.{c.weekly_reports[0]?.week_number} · utkast
                    </span>
                    <Link href={`/dashboard/${c.campaign_id}?tab=rapporter`}
                      className="rounded-[5px] bg-[rgba(29,158,117,0.1)] px-2 py-[3px] text-[10px] font-medium text-[#0F6E56] hover:bg-[rgba(29,158,117,0.2)]">
                      Öppna →
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── CHECKLISTOR ── */}
          {checklistInstances.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-zinc-400" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-600">
                  Checklistor att slutföra ({checklistInstances.length})
                </p>
              </div>
              <div className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
                {checklistInstances.map((inst, i) => (
                  <div key={inst.instance_id} className={`flex items-center gap-3 px-4 py-[9px] border-b border-zinc-50 last:border-0 ${i % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-zinc-900">{inst.campaign.client_name}</p>
                      <p className="text-[10px] text-zinc-400">{inst.template.name}{inst.week_number ? ` · v.${inst.week_number}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-[3px] w-[48px] rounded-full bg-zinc-200">
                        <div className={`h-full rounded-full ${inst.completion_pct < 40 ? "bg-[#E24B4A]" : inst.completion_pct < 75 ? "bg-[#EF9F27]" : "bg-[#1D9E75]"}`}
                          style={{ width: `${inst.completion_pct}%` }} />
                      </div>
                      <span className="text-[10px] text-zinc-400 w-[28px] text-right">{inst.completion_pct}%</span>
                    </div>
                    <Link href={`/dashboard/${inst.campaign.campaign_id}?tab=checklistor`}
                      className="rounded-[5px] bg-zinc-100 px-2 py-[3px] text-[10px] text-zinc-600 hover:bg-zinc-200">
                      Öppna →
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── KOMMANDE ── */}
          {upcoming.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-zinc-300" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-500">
                  Kommande ({upcoming.length})
                </p>
              </div>
              <div className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
                {upcoming.slice(0, 15).map((task, i) => (
                  <TaskRow key={task.task_id} task={task} today={today} isOverdue={false} stripe={i % 2 === 1} />
                ))}
                {upcoming.length > 15 && (
                  <p className="px-4 py-2 text-[11px] text-zinc-400">+{upcoming.length - 15} fler tasks</p>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Task row component ───────────────────────────────────────────────────────

type TaskWithRelations = Awaited<ReturnType<typeof prisma.task.findMany>>[number] & {
  campaign: { campaign_id: string; client_name: string; health_score: number } | null;
  assigned_to: { name: string };
};

function TaskRow({ task, today, isOverdue, stripe }: {
  task: TaskWithRelations;
  today: Date;
  isOverdue: boolean;
  stripe: boolean;
}) {
  const daysOff = Math.round((task.due_date.getTime() - today.getTime()) / 86400000);
  const dueLabel = isOverdue
    ? `${Math.abs(daysOff)} dag${Math.abs(daysOff) !== 1 ? "ar" : ""} sen`
    : daysOff === 0 ? "idag" : `om ${daysOff} dag${daysOff !== 1 ? "ar" : ""}`;

  return (
    <div className={`flex items-center gap-3 px-4 py-[9px] border-b border-zinc-50 last:border-0 ${stripe ? "bg-[#FAFAFA]" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[12px] font-medium text-zinc-900 leading-tight">{task.title}</p>
        </div>
        <div className="flex items-center gap-1.5 mt-[2px]">
          {task.campaign && (
            <Link href={`/dashboard/${task.campaign.campaign_id}?tab=tasks`}
              className="rounded-[3px] bg-zinc-100 px-[5px] py-[1px] text-[9px] text-zinc-500 hover:bg-zinc-200 leading-tight">
              {task.campaign.client_name}
            </Link>
          )}
          <span className="text-[10px] text-zinc-400">{task.assigned_to.name}</span>
        </div>
      </div>
      <span className={`shrink-0 rounded-[4px] px-[5px] py-[1px] text-[9px] font-medium ${PRIORITY_CLS[task.priority]}`}>
        {PRIORITY_LABELS[task.priority]}
      </span>
      <span className={`shrink-0 text-[10px] font-medium w-[72px] text-right ${isOverdue ? "text-[#E24B4A]" : daysOff === 0 ? "text-[#EF9F27]" : "text-zinc-400"}`}>
        {dueLabel}
      </span>
      <span className={`shrink-0 rounded-[4px] px-[5px] py-[1px] text-[9px] ${STATUS_CLS[task.status]}`}>
        {task.status === "open" ? "Öppen" : task.status === "in_progress" ? "Pågår" : "Klar"}
      </span>
    </div>
  );
}
