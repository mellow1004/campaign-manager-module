"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ChecklistItem {
  order: number;
  title: string;
  description?: string;
  is_blocking?: boolean;
  completed: boolean;
  completed_at: string | null;
}

interface ChecklistInstance {
  instance_id: string;
  completion_pct: number;
  week_number: number | null;
  items: ChecklistItem[];
  template: { type: string; name: string };
}

interface Props {
  instances: ChecklistInstance[];
}

function fmtShort(d: string) {
  return new Date(d).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

export default function ChecklistsTab({ instances: initial }: Props) {
  const router = useRouter();
  const [instances, setInstances] = useState<ChecklistInstance[]>(initial);
  const [, startTransition] = useTransition();

  async function toggleItem(instanceId: string, itemOrder: number, completed: boolean) {
    // Optimistic update
    setInstances((prev) =>
      prev.map((inst) => {
        if (inst.instance_id !== instanceId) return inst;
        const updatedItems = inst.items.map((item) =>
          item.order === itemOrder
            ? { ...item, completed, completed_at: completed ? new Date().toISOString() : null }
            : item
        );
        const done = updatedItems.filter((i) => i.completed).length;
        return {
          ...inst,
          items: updatedItems,
          completion_pct: Math.round((done / updatedItems.length) * 100),
        };
      })
    );

    await fetch(`/api/checklists/${instanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemOrder, completed }),
    });
    startTransition(() => router.refresh());
  }

  if (instances.length === 0) {
    return (
      <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-6 text-center text-[12px] text-zinc-400">
        Inga checklistor skapade för denna kampanj.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {instances.map((inst) => {
        const items = [...inst.items].sort((a, b) => a.order - b.order);
        const completedCount = items.filter((i) => i.completed).length;
        return (
          <div key={inst.instance_id} className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
            {/* Header */}
            <div className="border-b border-zinc-100 px-4 py-[8px] flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-medium text-zinc-700">{inst.template.name}</p>
                {inst.week_number && (
                  <span className="text-[10px] text-zinc-400">v.{inst.week_number}</span>
                )}
                <span className={`rounded-[4px] px-[5px] py-[1px] text-[9px] font-medium ${
                  inst.completion_pct === 100
                    ? "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]"
                    : inst.completion_pct > 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-zinc-100 text-zinc-500"
                }`}>
                  {inst.completion_pct === 100 ? "Klar" : inst.completion_pct > 0 ? "Pågår" : "Ej påbörjad"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-[3px] w-[60px] rounded-full bg-zinc-200">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      inst.completion_pct < 40
                        ? "bg-[#E24B4A]"
                        : inst.completion_pct < 75
                        ? "bg-[#EF9F27]"
                        : "bg-[#1D9E75]"
                    }`}
                    style={{ width: `${inst.completion_pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {completedCount}/{items.length}
                </span>
              </div>
            </div>

            {/* Items */}
            <div>
              {items.map((item, ii) => (
                <div
                  key={item.order}
                  className={`flex items-start gap-3 px-4 py-[8px] border-b border-zinc-50 last:border-0 ${
                    ii % 2 === 1 ? "bg-[#FAFAFA]" : ""
                  }`}
                >
                  <button
                    onClick={() => toggleItem(inst.instance_id, item.order, !item.completed)}
                    className={`mt-[1px] h-[14px] w-[14px] shrink-0 rounded-[3px] border-2 flex items-center justify-center transition-colors ${
                      item.completed
                        ? "bg-[#1D9E75] border-[#1D9E75]"
                        : "border-zinc-300 hover:border-[#1D9E75]"
                    }`}
                    aria-label={item.completed ? "Avmarkera" : "Markera som klar"}
                  >
                    {item.completed && (
                      <span className="text-white text-[8px] font-bold leading-none">✓</span>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p
                        className={`text-[12px] leading-tight ${
                          item.completed ? "line-through text-zinc-400" : "text-zinc-900"
                        }`}
                      >
                        {item.title}
                      </p>
                      {item.is_blocking && !item.completed && (
                        <span className="text-[10px]" title="Blockerande – måste slutföras">
                          🔒
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-[10px] text-zinc-400 leading-tight mt-[2px]">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {item.completed_at && (
                    <span className="shrink-0 text-[9px] text-zinc-400">
                      {fmtShort(item.completed_at)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
