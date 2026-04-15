"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TaskPriority, TaskStatus } from "@prisma/client";

const PRIORITY_CLS: Record<TaskPriority, string> = {
  high:   "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-zinc-100 text-zinc-600",
};
const PRIORITY_LABELS: Record<TaskPriority, string> = { high: "Hög", medium: "Medium", low: "Låg" };

type Task = {
  task_id: string; title: string; description: string;
  due_date: Date; priority: TaskPriority; status: TaskStatus;
  assigned_to: { name: string };
};

interface Props {
  tasks: Task[];
  campaignId: string;
  pmId: string;
}

const COL_CONFIG = [
  { key: "open"        as TaskStatus, label: "Öppen",  bg: "bg-zinc-50" },
  { key: "in_progress" as TaskStatus, label: "Pågår",  bg: "bg-amber-50" },
  { key: "done"        as TaskStatus, label: "Klar",   bg: "bg-[rgba(29,158,117,0.06)]" },
];

function fmtShort(d: Date) {
  return new Date(d).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

export default function TasksTab({ tasks: initialTasks, campaignId, pmId }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ── Update task status ──
  async function updateStatus(taskId: string, newStatus: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => t.task_id === taskId ? { ...t, status: newStatus } : t)
    );
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    startTransition(() => router.refresh());
  }

  // ── Create task ──
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id:    campaignId,
        title:          fd.get("title"),
        description:    fd.get("description") ?? "",
        due_date:       fd.get("due_date"),
        priority:       fd.get("priority"),
        assigned_to_id: pmId,
      }),
    });
    if (res.ok) {
      const newTask = await res.json() as Task;
      setTasks((prev) => [...prev, newTask]);
      setShowForm(false);
      startTransition(() => router.refresh());
    }
  }

  // ── Delete task ──
  async function deleteTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      {/* New task button */}
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-[6px] border border-[#1D9E75] bg-[rgba(29,158,117,0.07)] px-3 py-[5px] text-[11px] font-medium text-[#1D9E75] hover:bg-[rgba(29,158,117,0.15)]">
          {showForm ? "Avbryt" : "+ Ny task"}
        </button>
      </div>

      {/* New task form */}
      {showForm && (
        <form onSubmit={handleCreate}
          className="rounded-[8px] border border-zinc-200 bg-white px-4 py-3 space-y-3">
          <p className="text-[12px] font-medium text-zinc-700">Lägg till task</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-zinc-400">Titel *</label>
              <input name="title" required placeholder="Vad ska göras?"
                className="mt-[3px] w-full rounded-[5px] border border-zinc-200 px-2 py-[5px] text-[12px] focus:border-[#1D9E75] focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400">Förfallodatum *</label>
              <input name="due_date" type="date" required
                className="mt-[3px] w-full rounded-[5px] border border-zinc-200 px-2 py-[5px] text-[12px] focus:border-[#1D9E75] focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400">Prioritet</label>
              <select name="priority" defaultValue="medium"
                className="mt-[3px] w-full rounded-[5px] border border-zinc-200 px-2 py-[5px] text-[12px] focus:border-[#1D9E75] focus:outline-none">
                <option value="high">Hög</option>
                <option value="medium">Medium</option>
                <option value="low">Låg</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-[5px] border border-zinc-200 px-3 py-[5px] text-[11px] text-zinc-500">
              Avbryt
            </button>
            <button type="submit" disabled={isPending}
              className="rounded-[5px] bg-[#1D9E75] px-3 py-[5px] text-[11px] font-medium text-white hover:bg-[#178F68] disabled:opacity-50">
              Spara task
            </button>
          </div>
        </form>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-3 gap-3">
        {COL_CONFIG.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          const today = new Date(); today.setHours(0, 0, 0, 0);
          return (
            <div key={col.key} className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
              <div className={`border-b border-zinc-100 px-3 py-[8px] flex items-center justify-between ${col.bg}`}>
                <p className="text-[12px] font-medium text-zinc-700">{col.label}</p>
                <span className="rounded-full bg-zinc-200 px-[7px] py-[1px] text-[10px] text-zinc-600">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-[4px] p-2 min-h-[60px]">
                {colTasks.length === 0 && (
                  <p className="py-3 text-center text-[11px] text-zinc-400">Inga tasks</p>
                )}
                {colTasks.map((task) => {
                  const isOverdue = new Date(task.due_date) < today && task.status !== "done";
                  return (
                    <div key={task.task_id}
                      className="group rounded-[6px] border border-zinc-100 bg-zinc-50 p-[8px] hover:border-zinc-200">
                      <p className="text-[12px] font-medium text-zinc-900 leading-tight mb-[6px]">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-1 flex-wrap mb-[6px]">
                        <span className={`rounded-[4px] px-[5px] py-[1px] text-[9px] font-medium ${PRIORITY_CLS[task.priority]}`}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                        <span className={`text-[9px] ml-auto ${isOverdue ? "text-[#E24B4A] font-medium" : "text-zinc-400"}`}>
                          {isOverdue ? "⚠ " : ""}{fmtShort(task.due_date)}
                        </span>
                      </div>
                      {/* Status buttons */}
                      <div className="flex gap-[3px] flex-wrap">
                        {(["open", "in_progress", "done"] as TaskStatus[])
                          .filter((s) => s !== task.status)
                          .map((s) => (
                            <button key={s} onClick={() => updateStatus(task.task_id, s)}
                              className="rounded-[4px] bg-white border border-zinc-200 px-[5px] py-[2px] text-[9px] text-zinc-500 hover:border-zinc-400 hover:text-zinc-700">
                              → {s === "open" ? "Öppen" : s === "in_progress" ? "Pågår" : "Klar"}
                            </button>
                          ))}
                        <button onClick={() => deleteTask(task.task_id)}
                          className="ml-auto rounded-[4px] bg-white border border-zinc-100 px-[5px] py-[2px] text-[9px] text-zinc-300 hover:border-rose-200 hover:text-rose-500">
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
