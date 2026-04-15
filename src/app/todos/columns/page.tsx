import Link from "next/link";
import { TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type FilterType = "alla" | "forserade" | "hog";

interface PageProps {
  searchParams?: Promise<{ filter?: string }>;
}

const PRIORITY_BADGE_CLS: Record<TaskPriority, string> = {
  high: "bg-[rgba(226,75,74,0.1)] text-[#A32D2D]",
  medium: "bg-[rgba(239,159,39,0.1)] text-[#854F0B]",
  low: "bg-[rgba(99,153,34,0.1)] text-[#3B6D11]",
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtHeaderDate(date: Date): string {
  const dayNames = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
  const monthNames = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
  return `${dayNames[date.getDay()] ?? ""} ${date.getDate()} ${monthNames[date.getMonth()] ?? ""}`;
}

function dueMeta(dueDate: Date, today: Date): { label: string; cls: string; overdue: boolean; today: boolean } {
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) {
    return {
      label: `${Math.abs(diff)} dag${Math.abs(diff) === 1 ? "" : "ar"} sen`,
      cls: "text-[#A32D2D]",
      overdue: true,
      today: false,
    };
  }
  if (diff === 0) return { label: "Idag", cls: "text-[#854F0B]", overdue: false, today: true };
  return {
    label: d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }),
    cls: "text-[#71717A]",
    overdue: false,
    today: false,
  };
}

function healthTone(score: number): { dot: string; bar: string } {
  if (score < 40) return { dot: "bg-[#E24B4A]", bar: "bg-[#E24B4A]" };
  if (score < 75) return { dot: "bg-[#EF9F27]", bar: "bg-[#EF9F27]" };
  return { dot: "bg-[#1D9E75]", bar: "bg-[#1D9E75]" };
}

type TaskLite = {
  task_id: string;
  title: string;
  due_date: Date;
  priority: TaskPriority;
  status: string;
};

export default async function TodoColumnsPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : undefined;
  const activeFilter: FilterType =
    sp?.filter === "hog" ? "hog" : sp?.filter === "forserade" || sp?.filter === "forsenade" ? "forserade" : "alla";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = getWeekStart(today);

  const [pm, campaigns] = await Promise.all([
    prisma.user.findFirst({ where: { role: "pm" }, select: { name: true, avatar_initials: true } }),
    prisma.campaign.findMany({
      where: { status: { in: ["active", "closing", "onboarding"] } },
      select: {
        campaign_id: true,
        client_name: true,
        market: true,
        health_score: true,
        weekly_meeting_target: true,
        tasks: {
          where: { status: { in: ["open", "in_progress"] } },
          select: { task_id: true, title: true, due_date: true, priority: true, status: true },
          orderBy: [{ due_date: "asc" }, { priority: "asc" }],
        },
        activity_logs: {
          where: { date: { gte: weekStart, lte: today } },
          select: { meetings_booked: true },
        },
        checklist_instances: {
          where: { template: { type: "weekly" } },
          orderBy: { created_at: "desc" },
          take: 1,
          select: {
            instance_id: true,
            items: true,
            template: { select: { name: true } },
          },
        },
      },
      orderBy: { health_score: "asc" },
    }),
  ]);

  const totalOpenTasks = campaigns.reduce((sum, c) => sum + c.tasks.length, 0);

  const filteredCampaigns = campaigns
    .map((campaign) => {
      const overdue = campaign.tasks.filter((t) => t.due_date < today);
      const todayOrFuture = campaign.tasks.filter((t) => t.due_date >= today);
      const filteredTasks =
        activeFilter === "forserade"
          ? overdue
          : activeFilter === "hog"
          ? campaign.tasks.filter((t) => t.priority === "high")
          : campaign.tasks;
      return { campaign, overdue, todayOrFuture, filteredTasks };
    })
    .filter((x) => (activeFilter === "alla" ? true : x.filteredTasks.length > 0));

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
            <p className="truncate text-[11px] text-white/60 leading-tight">{pm?.name ?? "PM"}</p>
            <p className="mt-[1px] text-[10px] text-white/30">Project Manager</p>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-[#E4E4E7] bg-white px-[18px] py-[13px]">
          <div>
            <p className="text-[15px] font-medium text-[#18181B]">Alla kampanjer – todos</p>
            <p className="text-[11px] text-[#71717A]">
              {fmtHeaderDate(today)} · {totalOpenTasks} öppna uppgifter · {campaigns.length} kampanjer
            </p>
          </div>
          <div className="flex items-center gap-[8px]">
            <div className="flex gap-[3px] rounded-[6px] border border-[#E4E4E7] bg-[#F4F4F5] p-[3px]">
              <Link href="/todos" className="px-[10px] py-[4px] text-[11px] text-[#71717A]">
                Dagslista
              </Link>
              <Link
                href="/todos/columns"
                className="rounded-[4px] border border-[#E4E4E7] bg-white px-[10px] py-[4px] text-[11px] text-[#18181B]"
              >
                Kampanjkolumner
              </Link>
            </div>
            <div className="flex items-center gap-[6px]">
              {([
                { id: "alla", label: "Alla tasks" },
                { id: "forserade", label: "Försenade" },
                { id: "hog", label: "Hög prio" },
              ] as const).map((chip) => (
                <Link
                  key={chip.id}
                  href={chip.id === "alla" ? "/todos/columns" : `/todos/columns?filter=${chip.id}`}
                  className={`rounded-[10px] border px-[9px] py-[3px] text-[10px] ${
                    activeFilter === chip.id
                      ? "border-[#185FA5] bg-[rgba(55,138,221,0.08)] text-[#185FA5]"
                      : "border-[#E4E4E7] bg-white text-[#71717A]"
                  }`}
                >
                  {chip.label}
                </Link>
              ))}
            </div>
          </div>
        </header>

        <div className="todos-board-scroll flex flex-1 items-start gap-[10px] overflow-x-auto overflow-y-hidden p-[14px]">
          {filteredCampaigns.map(({ campaign, filteredTasks }) => {
            const health = healthTone(campaign.health_score);
            const thisWeekMeetings = campaign.activity_logs.reduce((s, l) => s + l.meetings_booked, 0);
            const meetPct =
              campaign.weekly_meeting_target > 0
                ? Math.min(100, Math.round((thisWeekMeetings / campaign.weekly_meeting_target) * 100))
                : 0;
            const meetTone =
              meetPct >= 100
                ? { cls: "text-[#71717A]", valCls: "text-[#1D9E75]" }
                : meetPct >= 70
                ? { cls: "text-[#EF9F27]", valCls: "text-[#EF9F27]" }
                : { cls: "text-[#E24B4A]", valCls: "text-[#E24B4A]" };

            const checklist = campaign.checklist_instances[0] ?? null;
            const checklistItems = ((checklist?.items as Array<{ title: string; order: number; completed?: boolean }> | undefined) ?? [])
              .sort((a, b) => a.order - b.order)
              .slice(0, 7);
            const checklistDone = checklistItems.filter((i) => i.completed).length;

            const shownOverdue = filteredTasks.filter((t) => t.due_date < today);
            const shownTodayFuture = filteredTasks.filter((t) => t.due_date >= today);

            return (
              <div
                key={campaign.campaign_id}
                className={`flex w-[220px] shrink-0 flex-col overflow-hidden rounded-[8px] border bg-white ${
                  campaign.health_score < 40 ? "border-[rgba(226,75,74,0.3)]" : "border-[#E4E4E7]"
                }`}
              >
                <div className="border-b border-[#F4F4F5] bg-[#FAFAFA] px-[12px] py-[10px]">
                  <div className="mb-[4px] flex items-center gap-[6px]">
                    <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${health.dot}`} />
                    <p className="truncate text-[12px] font-medium text-[#18181B]">{campaign.client_name}</p>
                  </div>
                  <div className={`mb-[6px] flex items-center justify-between text-[10px] ${meetTone.cls}`}>
                    <span className="truncate text-[#71717A]">{campaign.market}</span>
                    <span className="ml-2 whitespace-nowrap">
                      Möten:{" "}
                      <b className={meetTone.valCls}>
                        {thisWeekMeetings}/{campaign.weekly_meeting_target}
                      </b>{" "}
                      v.
                    </span>
                  </div>
                  <div className="h-[3px] rounded-[2px] bg-[#E4E4E7]">
                    <div className={`h-full rounded-[2px] ${health.bar}`} style={{ width: `${Math.max(5, campaign.health_score)}%` }} />
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-[5px] p-[8px]">
                  {shownOverdue.length > 0 && (
                    <div className="overflow-hidden rounded-[6px] border border-[rgba(226,75,74,0.2)]">
                      <div className="flex items-center gap-[5px] border-b border-[#F4F4F5] bg-[#FAFAFA] px-[9px] py-[5px]">
                        <span className="flex h-[15px] w-[15px] items-center justify-center rounded-[3px] bg-[rgba(226,75,74,0.1)] text-[9px] text-[#A32D2D]">
                          !
                        </span>
                        <span className="text-[9px] text-[#71717A]">Försenade</span>
                        <span className="ml-auto text-[9px] text-[#71717A]">{shownOverdue.length}</span>
                      </div>
                      {shownOverdue.map((task) => (
                        <TaskItem key={task.task_id} task={task} today={today} />
                      ))}
                    </div>
                  )}

                  {(shownTodayFuture.length > 0 || (shownOverdue.length === 0 && filteredTasks.length === 0)) && (
                    <div className="overflow-hidden rounded-[6px] border border-[#E4E4E7]">
                      <div className="flex items-center gap-[5px] border-b border-[#F4F4F5] bg-[#FAFAFA] px-[9px] py-[5px]">
                        <span className="flex h-[15px] w-[15px] items-center justify-center rounded-[3px] bg-[rgba(55,138,221,0.08)] text-[9px] text-[#185FA5]">
                          ✦
                        </span>
                        <span className="text-[9px] text-[#71717A]">{shownTodayFuture.some((t) => t.due_date > today) ? "Idag & framåt" : "Idag"}</span>
                        <span className="ml-auto text-[9px] text-[#71717A]">{shownTodayFuture.length}</span>
                      </div>
                      {shownTodayFuture.map((task) => (
                        <TaskItem key={task.task_id} task={task} today={today} />
                      ))}
                      {shownTodayFuture.length === 0 && (
                        <p className="px-[9px] py-[7px] text-[10px] text-[#A1A1AA]">Inga tasks i urvalet.</p>
                      )}
                    </div>
                  )}
                </div>

                {checklist && checklistItems.length > 0 && (
                  <div className="border-t border-[#F4F4F5]">
                    <div className="flex items-center justify-between border-b border-[#F4F4F5] bg-[#FAFAFA] px-[9px] py-[5px]">
                      <p className="text-[9px] font-medium uppercase text-[#71717A]">Veckochecklista</p>
                      <p className="text-[9px] text-[#71717A]">
                        {checklistDone}/{checklistItems.length} klara
                      </p>
                    </div>
                    {checklistItems.map((item) => (
                      <div key={`${item.order}-${item.title}`} className="flex items-center gap-[6px] border-b border-[#F4F4F5] px-[9px] py-[5px] hover:bg-[#FAFAFA]">
                        <span
                          className={`flex h-[12px] w-[12px] items-center justify-center rounded-full border text-[7px] ${
                            item.completed ? "border-[#1D9E75] bg-[#1D9E75] text-white" : "border-[#D4D4D8] text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <p className={`text-[10px] ${item.completed ? "text-[#A1A1AA] line-through" : "text-[#18181B]"}`}>{item.title}</p>
                      </div>
                    ))}
                  </div>
                )}

                <Link
                  href={`/dashboard/${campaign.campaign_id}?tab=tasks`}
                  className="flex items-center gap-[5px] border-t border-[#F4F4F5] px-[9px] py-[7px] text-[11px] text-[#A1A1AA] hover:bg-[#FAFAFA] hover:text-[#71717A]"
                >
                  + Ny task
                </Link>
              </div>
            );
          })}
        </div>
      </main>
      <style jsx global>{`
        .todos-board-scroll::-webkit-scrollbar {
          height: 5px;
        }
        .todos-board-scroll::-webkit-scrollbar-thumb {
          background: #d4d4d8;
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}

function TaskItem({ task, today }: { task: TaskLite; today: Date }) {
  const due = dueMeta(task.due_date, today);
  return (
    <div className="flex items-start gap-[7px] border-b border-[#F4F4F5] px-[9px] py-[7px] hover:bg-[#FAFAFA]">
      <span
        className={`flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[3px] border text-[8px] ${
          task.status === "done" ? "border-[#1D9E75] bg-[#1D9E75] text-white" : "border-[#D4D4D8] bg-white text-transparent"
        }`}
      >
        ✓
      </span>
      <div className="min-w-0 flex-1">
        <p className={`mb-[3px] text-[11px] leading-[1.3] ${task.status === "done" ? "text-[#A1A1AA] line-through" : "text-[#18181B]"}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-[4px]">
          <span className={`rounded-[3px] px-[5px] py-[1px] text-[9px] font-medium ${PRIORITY_BADGE_CLS[task.priority]}`}>
            {task.priority === "high" ? "Hög" : task.priority === "medium" ? "Med" : "Låg"}
          </span>
          <span className={`ml-auto text-[9px] ${due.cls}`}>{due.label}</span>
        </div>
      </div>
    </div>
  );
}
