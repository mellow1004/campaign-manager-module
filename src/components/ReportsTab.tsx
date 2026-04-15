"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface WeeklyReport {
  report_id: string;
  week_number: number;
  year: number;
  status: "draft" | "sent";
  meetings_week: number;
  meetings_mtd: number;
  meetings_total: number;
  ai_commentary: string;
  pm_commentary: string;
  next_week_focus: string;
  sent_at: string | null;
}

interface ActivitySummary {
  dials: number;
  connects: number;
  emails_sent: number;
  replies: number;
  linkedin_requests: number;
  linkedin_accepted: number;
}

interface Props {
  reports: WeeklyReport[];
  campaignId: string;
  pmId: string;
  clientName: string;
  market: string;
  currentWeekNumber: number;
  currentYear: number;
  weeklyMeetingTarget: number;
  monthlyMeetingTarget: number;
  thisWeekActivity: ActivitySummary;
  meetingsWeek: number;
  meetingsMtd: number;
  currentFocus: string;
  pace: "on_track" | "behind" | "ahead";
}

function fmtShort(d: string) {
  return new Date(d).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

const PACE_LABELS: Record<"on_track" | "behind" | "ahead", { label: string; cls: string }> = {
  on_track: { label: "På spår",  cls: "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]" },
  behind:   { label: "Bakom",    cls: "bg-[rgba(226,75,74,0.1)] text-[#A32D2D]" },
  ahead:    { label: "Före",     cls: "bg-[rgba(55,138,221,0.1)] text-[#185FA5]" },
};

export default function ReportsTab({
  reports: initialReports,
  campaignId,
  pmId,
  clientName,
  market,
  currentWeekNumber,
  currentYear,
  weeklyMeetingTarget,
  monthlyMeetingTarget,
  thisWeekActivity,
  meetingsWeek,
  meetingsMtd,
  currentFocus,
  pace,
}: Props) {
  const router = useRouter();
  const [reports, setReports] = useState<WeeklyReport[]>(initialReports);
  const [showForm, setShowForm] = useState(false);
  const [viewReport, setViewReport] = useState<WeeklyReport | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiComment, setAiComment] = useState("");
  const [pmComment, setPmComment] = useState("");
  const [nextFocus, setNextFocus] = useState(currentFocus);
  const [, startTransition] = useTransition();

  async function generateAI() {
    setGenerating(true);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          market,
          weekNumber: currentWeekNumber,
          activity: thisWeekActivity,
          meetingsWeek,
          weeklyMeetingTarget,
          meetingsMtd,
          monthlyMeetingTarget,
          currentFocus,
        }),
      });
      if (res.ok) {
        const { commentary } = await res.json() as { commentary: string };
        setAiComment(commentary);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id:             campaignId,
        sent_by_id:              pmId,
        week_number:             currentWeekNumber,
        year:                    currentYear,
        meetings_week:           meetingsWeek,
        meetings_mtd:            meetingsMtd,
        meetings_total:          meetingsMtd,
        ai_commentary:           aiComment,
        pm_commentary:           pmComment,
        next_week_focus:         nextFocus,
        activity_summary:        thisWeekActivity,
        recipients:              [],
        status:                  "draft",
      }),
    });

    if (res.ok) {
      const newReport = await res.json() as WeeklyReport;
      setReports((prev) => [newReport, ...prev]);
      setShowForm(false);
      setAiComment("");
      setPmComment("");
      startTransition(() => router.refresh());
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-zinc-400">
          {reports.length} rapporter totalt
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-[6px] border border-[#1D9E75] bg-[rgba(29,158,117,0.07)] px-[10px] py-[5px] text-[11px] text-[#1D9E75] font-medium hover:bg-[rgba(29,158,117,0.15)]"
        >
          {showForm ? "Avbryt" : "+ Generera rapport"}
        </button>
      </div>

      {/* Report generation form */}
      {showForm && (
        <div className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-[8px] flex items-center justify-between">
            <p className="text-[12px] font-medium text-zinc-700">
              Veckorapport v.{currentWeekNumber} {currentYear}
            </p>
            <div className="flex items-center gap-2">
              <span className={`rounded-[4px] px-[6px] py-[1px] text-[10px] font-medium ${PACE_LABELS[pace].cls}`}>
                {PACE_LABELS[pace].label}
              </span>
              <span className="rounded-[4px] bg-amber-100 px-[6px] py-[1px] text-[10px] text-amber-700 font-medium">
                Utkast
              </span>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Activity summary (read-only) */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-zinc-400 mb-2">
                Aktivitet denna vecka
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Möten", val: meetingsWeek, target: weeklyMeetingTarget, highlight: true },
                  { label: "Dials",    val: thisWeekActivity.dials },
                  { label: "Connects", val: thisWeekActivity.connects },
                  { label: "Email",    val: thisWeekActivity.emails_sent },
                ].map(({ label, val, target, highlight }) => (
                  <div key={label} className="rounded-[6px] border border-zinc-100 bg-zinc-50 px-3 py-2">
                    <p className="text-[9px] text-zinc-400">{label}</p>
                    <p className={`text-[16px] font-medium ${highlight ? "text-[#1D9E75]" : "text-[#18181B]"}`}>
                      {val}
                    </p>
                    {target !== undefined && (
                      <p className="text-[9px] text-zinc-400">mål: {target}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* AI commentary */}
            <div>
              <div className="flex items-center justify-between mb-[6px]">
                <label className="text-[10px] font-medium uppercase tracking-[0.4px] text-zinc-400">
                  AI-kommentar
                </label>
                <button
                  type="button"
                  onClick={generateAI}
                  disabled={generating}
                  className="flex items-center gap-1 rounded-[5px] border border-zinc-200 bg-white px-2 py-[4px] text-[10px] text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <span className="animate-spin">⟳</span> Genererar…
                    </>
                  ) : (
                    <>✦ Generera med AI</>
                  )}
                </button>
              </div>
              <textarea
                value={aiComment}
                onChange={(e) => setAiComment(e.target.value)}
                rows={4}
                placeholder="Klicka 'Generera med AI' eller skriv en kommentar manuellt…"
                className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-[12px] text-zinc-900 placeholder:text-zinc-300 focus:border-[#1D9E75] focus:outline-none resize-none"
              />
            </div>

            {/* PM commentary */}
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-[0.4px] text-zinc-400 mb-[6px]">
                PM-kommentar
              </label>
              <textarea
                value={pmComment}
                onChange={(e) => setPmComment(e.target.value)}
                rows={3}
                placeholder="Lägg till egna noteringar för rapporten…"
                className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-[12px] text-zinc-900 placeholder:text-zinc-300 focus:border-[#1D9E75] focus:outline-none resize-none"
              />
            </div>

            {/* Next week focus */}
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-[0.4px] text-zinc-400 mb-[6px]">
                Nästa veckas fokus
              </label>
              <input
                value={nextFocus}
                onChange={(e) => setNextFocus(e.target.value)}
                placeholder="Vad är fokus nästa vecka?"
                className="w-full rounded-[6px] border border-zinc-200 px-3 py-[7px] text-[12px] text-zinc-900 placeholder:text-zinc-300 focus:border-[#1D9E75] focus:outline-none"
              />
            </div>

            {/* Actions */}
            <form onSubmit={handleCreate}>
              <div className="flex justify-end gap-2 pt-1 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-[5px] border border-zinc-200 px-3 py-[5px] text-[11px] text-zinc-500 hover:bg-zinc-50"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-[5px] bg-zinc-800 px-4 py-[5px] text-[11px] font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {saving ? "Sparar…" : "Spara som utkast"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-[10px] border border-zinc-200 bg-white shadow-xl overflow-hidden">
            <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-zinc-900">
                v.{viewReport.week_number} {viewReport.year} – {clientName}
              </p>
              <button
                onClick={() => setViewReport(null)}
                className="text-zinc-400 hover:text-zinc-700 text-[18px] leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Möten veckan", val: viewReport.meetings_week },
                  { label: "MTD-möten",   val: viewReport.meetings_mtd },
                  { label: "Totalt",       val: viewReport.meetings_total },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-[6px] border border-zinc-100 bg-zinc-50 px-3 py-2 text-center">
                    <p className="text-[9px] text-zinc-400">{label}</p>
                    <p className="text-[18px] font-medium text-[#18181B]">{val}</p>
                  </div>
                ))}
              </div>

              {viewReport.ai_commentary && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-zinc-400 mb-1">
                    AI-kommentar
                  </p>
                  <p className="text-[12px] text-zinc-700 leading-relaxed bg-zinc-50 rounded-[6px] p-3 border border-zinc-100">
                    {viewReport.ai_commentary}
                  </p>
                </div>
              )}

              {viewReport.pm_commentary && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-zinc-400 mb-1">
                    PM-kommentar
                  </p>
                  <p className="text-[12px] text-zinc-700 leading-relaxed">{viewReport.pm_commentary}</p>
                </div>
              )}

              {viewReport.next_week_focus && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-zinc-400 mb-1">
                    Nästa veckas fokus
                  </p>
                  <p className="text-[12px] text-zinc-700">{viewReport.next_week_focus}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reports table */}
      {reports.length === 0 ? (
        <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-6 text-center text-[12px] text-zinc-400">
          Inga rapporter genererade än.
        </div>
      ) : (
        <div className="rounded-[8px] border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                {["Vecka", "Möten", "MTD", "Status", "Skickad", ""].map((h) => (
                  <th key={h} className="px-4 py-[7px] text-left font-medium text-zinc-500 text-[10px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((report, ri) => (
                <tr
                  key={report.report_id}
                  className={`border-b border-zinc-50 hover:bg-zinc-50 ${ri % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}
                >
                  <td className="px-4 py-[7px] font-medium text-zinc-900">
                    v.{report.week_number} {report.year}
                  </td>
                  <td className="px-4 py-[7px] font-medium">{report.meetings_week}</td>
                  <td className="px-4 py-[7px] text-zinc-600">{report.meetings_mtd}</td>
                  <td className="px-4 py-[7px]">
                    <span
                      className={`rounded-[6px] px-[6px] py-[2px] text-[10px] font-medium ${
                        report.status === "sent"
                          ? "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {report.status === "sent" ? "Skickad" : "Utkast"}
                    </span>
                  </td>
                  <td className="px-4 py-[7px] text-zinc-400 text-[11px]">
                    {report.sent_at ? fmtShort(report.sent_at) : "–"}
                  </td>
                  <td className="px-4 py-[7px]">
                    <button
                      onClick={() => setViewReport(report)}
                      className="text-[11px] text-zinc-400 hover:text-zinc-700"
                    >
                      Visa →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
