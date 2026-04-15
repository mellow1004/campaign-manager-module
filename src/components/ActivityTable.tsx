"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type ActivityTableLog = {
  log_id: string;
  date: string;
  dials: number;
  connects: number;
  emails_sent: number;
  replies: number;
  linkedin_requests: number;
  linkedin_accepted: number;
  meetings_booked: number;
};

export interface ActivityTableProps {
  campaignId: string;
  logs: ActivityTableLog[];
}

function parseLocalDay(dateStr: string): Date {
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

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

function fmtShort(d: Date): string {
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

type WeekGroup = {
  weekKey: string;
  label: string;
  logs: ActivityTableLog[];
};

function groupLogsByWeek(logs: ActivityTableLog[]): WeekGroup[] {
  const weekMap = new Map<string, WeekGroup>();
  for (const log of logs) {
    const logDate = parseLocalDay(log.date);
    const ws = getWeekStart(logDate);
    const key = ws.toISOString();
    if (!weekMap.has(key)) {
      weekMap.set(key, {
        weekKey: key,
        label: `v.${isoWeek(ws)} – ${fmtShort(ws)}`,
        logs: [],
      });
    }
    weekMap.get(key)!.logs.push(log);
  }
  return Array.from(weekMap.values());
}

const inputCls =
  "w-full min-w-0 rounded-[4px] border border-zinc-200 bg-white px-[6px] py-[4px] text-[11px] text-right tabular-nums outline-none focus:border-[#1D9E75]";

function EditRow({
  log,
  campaignId,
  onCancel,
  onSaved,
}: {
  log: ActivityTableLog;
  campaignId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [dials, setDials] = useState(log.dials);
  const [connects, setConnects] = useState(log.connects);
  const [emailsSent, setEmailsSent] = useState(log.emails_sent);
  const [replies, setReplies] = useState(log.replies);
  const [liReq, setLiReq] = useState(log.linkedin_requests);
  const [liAcc, setLiAcc] = useState(log.linkedin_accepted);
  const [meetings, setMeetings] = useState(log.meetings_booked);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          date: log.date,
          dials,
          connects,
          emails_sent: emailsSent,
          replies,
          linkedin_requests: liReq,
          linkedin_accepted: liAcc,
          meetings_booked: meetings,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Kunde inte spara");
        return;
      }
      onSaved();
      router.refresh();
    } catch {
      setError("Nätverksfel");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-zinc-200 bg-[rgba(29,158,117,0.06)]">
      <td colSpan={8} className="px-3 py-[8px]">
        <form onSubmit={submit} className="space-y-[8px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-[6px]">
            <span className="text-[11px] font-medium text-zinc-700">
              Redigera {fmtShort(parseLocalDay(log.date))}
            </span>
            <span className="text-[10px] text-zinc-400">{log.date}</span>
          </div>
          <div className="grid grid-cols-4 gap-x-2 gap-y-[6px] sm:grid-cols-7">
            {(
              [
                ["Dials", dials, setDials],
                ["Connects", connects, setConnects],
                ["Email skickade", emailsSent, setEmailsSent],
                ["Svar", replies, setReplies],
                ["LI förfr.", liReq, setLiReq],
                ["LI accept.", liAcc, setLiAcc],
                ["Möten", meetings, setMeetings],
              ] as const
            ).map(([label, val, set]) => (
              <label key={label} className="block min-w-[72px]">
                <span className="mb-[2px] block text-[9px] text-zinc-500">{label}</span>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={val}
                  onChange={(ev) => set(Math.max(0, Number.parseInt(ev.target.value, 10) || 0))}
                />
              </label>
            ))}
          </div>
          {error && <p className="text-[10px] text-[#E24B4A]">{error}</p>}
          <div className="flex gap-[6px]">
            <button
              type="submit"
              disabled={saving}
              className="rounded-[5px] bg-[#1D9E75] px-3 py-[5px] text-[11px] font-medium text-white hover:bg-[#178F68] disabled:opacity-50"
            >
              {saving ? "Sparar…" : "Spara"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-[5px] border border-zinc-200 px-3 py-[5px] text-[11px] text-zinc-600 hover:bg-zinc-50"
            >
              Avbryt
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

export default function ActivityTable({ campaignId, logs }: ActivityTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const weekGroups = useMemo(() => groupLogsByWeek(logs), [logs]);

  return (
    <div className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-[8px]">
        <p className="text-[12px] font-medium text-zinc-700">Aktivitetslogg</p>
        <span className="text-[10px] text-zinc-400">{logs.length} rader</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              {["Datum", "Dials", "Connects", "Email skickade", "Svar", "LI förfr.", "LI accept.", "Möten"].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-[6px] text-left font-medium text-zinc-500">
                  {h}
                </th>
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
                {
                  dials: 0,
                  connects: 0,
                  emails_sent: 0,
                  replies: 0,
                  linkedin_requests: 0,
                  linkedin_accepted: 0,
                  meetings_booked: 0,
                }
              );
              return (
                <Fragment key={wg.weekKey}>
                  {wg.logs.map((log, li) =>
                    editingId === log.log_id ? (
                      <EditRow
                        key={log.log_id}
                        log={log}
                        campaignId={campaignId}
                        onCancel={() => setEditingId(null)}
                        onSaved={() => setEditingId(null)}
                      />
                    ) : (
                      <tr
                        key={log.log_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditingId(log.log_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEditingId(log.log_id);
                          }
                        }}
                        className={`cursor-pointer border-b border-zinc-50 hover:bg-zinc-50 ${li % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}
                      >
                        <td className="whitespace-nowrap px-3 py-[5px] text-zinc-600">
                          {fmtShort(parseLocalDay(log.date))}
                        </td>
                        <td className="px-3 py-[5px] text-right font-medium">{log.dials}</td>
                        <td className="px-3 py-[5px] text-right font-medium">{log.connects}</td>
                        <td className="px-3 py-[5px] text-right font-medium">{log.emails_sent}</td>
                        <td className="px-3 py-[5px] text-right font-medium">{log.replies}</td>
                        <td className="px-3 py-[5px] text-right font-medium">{log.linkedin_requests}</td>
                        <td className="px-3 py-[5px] text-right font-medium">{log.linkedin_accepted}</td>
                        <td className="px-3 py-[5px] text-right font-bold text-[#18181B]">{log.meetings_booked}</td>
                      </tr>
                    )
                  )}
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
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {logs.length === 0 && (
          <p className="px-4 py-4 text-[12px] text-zinc-400">Ingen aktivitet loggad än.</p>
        )}
      </div>
    </div>
  );
}
