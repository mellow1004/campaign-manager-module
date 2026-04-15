"use client";

import { useEffect, useMemo, useState } from "react";
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

type HistoryItem = {
  id: string;
  week_number: number;
  year: number;
  status: "draft" | "sent";
  sent_at: string | null;
  report: WeeklyReport | null;
  isVirtualDraft: boolean;
};

const VIRTUAL_DRAFT_ID = "__current_week_draft__";

function fmtShort(d: string): string {
  return new Date(d).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

function getIsoWeekStart(week: number, year: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return target;
}

function weekRangeLabel(week: number, year: number): string {
  const start = getIsoWeekStart(week, year);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const startLocal = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endLocal = new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const s = startLocal.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  const e = endLocal.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  return `${s} – ${e}`;
}

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
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [aiCommentary, setAiCommentary] = useState("");
  const [pmCommentary, setPmCommentary] = useState("");
  const [nextWeekFocus, setNextWeekFocus] = useState(currentFocus);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  const reportsSorted = useMemo(
    () =>
      [...reports].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.week_number - a.week_number;
      }),
    [reports]
  );

  const hasCurrentWeekReport = reportsSorted.some((r) => r.week_number === currentWeekNumber && r.year === currentYear);

  const historyItems = useMemo<HistoryItem[]>(() => {
    const mapped: HistoryItem[] = reportsSorted.map((r) => ({
      id: r.report_id,
      week_number: r.week_number,
      year: r.year,
      status: r.status,
      sent_at: r.sent_at,
      report: r,
      isVirtualDraft: false,
    }));
    if (!hasCurrentWeekReport) {
      mapped.unshift({
        id: VIRTUAL_DRAFT_ID,
        week_number: currentWeekNumber,
        year: currentYear,
        status: "draft",
        sent_at: null,
        report: null,
        isVirtualDraft: true,
      });
    }
    return mapped;
  }, [reportsSorted, hasCurrentWeekReport, currentWeekNumber, currentYear]);

  useEffect(() => {
    if (!selectedReportId) {
      setSelectedReportId(historyItems[0]?.id ?? null);
    }
  }, [historyItems, selectedReportId]);

  const selectedHistory = historyItems.find((h) => h.id === selectedReportId) ?? historyItems[0] ?? null;

  const selectedData = useMemo(() => {
    if (!selectedHistory) return null;
    if (selectedHistory.report) return selectedHistory.report;
    return {
      report_id: VIRTUAL_DRAFT_ID,
      week_number: currentWeekNumber,
      year: currentYear,
      status: "draft" as const,
      meetings_week: meetingsWeek,
      meetings_mtd: meetingsMtd,
      meetings_total: meetingsMtd,
      ai_commentary: "",
      pm_commentary: "",
      next_week_focus: currentFocus,
      sent_at: null,
    };
  }, [selectedHistory, currentWeekNumber, currentYear, meetingsWeek, meetingsMtd, currentFocus]);

  useEffect(() => {
    if (!selectedData) return;
    setAiCommentary(selectedData.ai_commentary ?? "");
    setPmCommentary(selectedData.pm_commentary ?? "");
    setNextWeekFocus(selectedData.next_week_focus ?? currentFocus);
  }, [selectedData, currentFocus]);

  const weekLabel = selectedData ? weekRangeLabel(selectedData.week_number, selectedData.year) : "–";

  const meetingsByPhone = Math.round(meetingsWeek * 0.5);
  const meetingsByEmail = Math.round(meetingsWeek * 0.2);
  const meetingsByLI = Math.max(0, meetingsWeek - meetingsByPhone - meetingsByEmail);

  const paceBadge =
    pace === "on_track"
      ? { label: `↑ På spår mot ${monthlyMeetingTarget}/mån-mål`, cls: "text-[#3B6D11] bg-[#EAF3DE]" }
      : pace === "behind"
      ? { label: `↓ Bakom ${monthlyMeetingTarget}/mån-mål`, cls: "text-[#A32D2D] bg-[rgba(226,75,74,0.08)]" }
      : { label: `↑ Före ${monthlyMeetingTarget}/mån-mål`, cls: "text-[#185FA5] bg-[rgba(55,138,221,0.08)]" };

  async function generateAI(): Promise<void> {
    if (!selectedData) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          market,
          weekNumber: selectedData.week_number,
          activity: thisWeekActivity,
          meetingsWeek: selectedData.meetings_week,
          weeklyMeetingTarget,
          meetingsMtd: selectedData.meetings_mtd,
          monthlyMeetingTarget,
          currentFocus: nextWeekFocus || currentFocus,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { commentary: string };
      setAiCommentary(data.commentary);
    } finally {
      setGenerating(false);
    }
  }

  async function createCurrentDraftIfNeeded(): Promise<string | null> {
    if (!selectedData) return null;
    if (!selectedHistory?.isVirtualDraft && selectedData.report_id !== VIRTUAL_DRAFT_ID) return selectedData.report_id;

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: campaignId,
        sent_by_id: pmId,
        week_number: currentWeekNumber,
        year: currentYear,
        meetings_week: selectedData.meetings_week,
        meetings_mtd: selectedData.meetings_mtd,
        meetings_total: selectedData.meetings_total,
        ai_commentary: aiCommentary,
        pm_commentary: pmCommentary,
        next_week_focus: nextWeekFocus,
        activity_summary: thisWeekActivity,
        recipients: [],
        status: "draft",
      }),
    });
    if (!res.ok) return null;
    const created = (await res.json()) as WeeklyReport;
    setReports((prev) => [created, ...prev.filter((r) => r.report_id !== created.report_id)]);
    setSelectedReportId(created.report_id);
    return created.report_id;
  }

  async function saveDraft(): Promise<void> {
    if (!selectedData) return;
    setSaving(true);
    try {
      const reportId = await createCurrentDraftIfNeeded();
      if (!reportId) return;
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pm_commentary: pmCommentary,
          next_week_focus: nextWeekFocus,
          ai_commentary: aiCommentary,
        }),
      });
      if (!res.ok) return;
      const updated = (await res.json()) as WeeklyReport;
      setReports((prev) => prev.map((r) => (r.report_id === updated.report_id ? updated : r)));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function sendReport(): Promise<void> {
    if (!selectedData) return;
    setSending(true);
    try {
      const reportId = await createCurrentDraftIfNeeded();
      if (!reportId) return;
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pm_commentary: pmCommentary,
          next_week_focus: nextWeekFocus,
          ai_commentary: aiCommentary,
          status: "sent",
          sent_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) return;
      const updated = (await res.json()) as WeeklyReport;
      setReports((prev) => prev.map((r) => (r.report_id === updated.report_id ? updated : r)));
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  if (!selectedData) {
    return <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-4 py-4 text-[12px] text-[#71717A]">Ingen rapportdata.</div>;
  }

  return (
    <div className="h-full min-h-[640px]">
      <div className="grid h-full grid-cols-[150px_1fr_1fr] gap-[12px]">
        <section className="flex flex-col overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
          <div className="flex items-center justify-between border-b border-[#F4F4F5] bg-[#FAFAFA] px-[13px] py-[10px]">
            <p className="text-[12px] font-medium text-[#18181B]">Historik</p>
          </div>
          <div className="overflow-y-auto">
            {historyItems.map((item) => {
              const selected = item.id === selectedData.report_id || item.id === selectedReportId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedReportId(item.id)}
                  className={`flex w-full cursor-pointer items-center justify-between border-b border-[#F4F4F5] px-[13px] py-[9px] text-left hover:bg-[#FAFAFA] ${
                    selected ? "bg-[rgba(55,138,221,0.05)]" : ""
                  }`}
                >
                  <div>
                    <p className={`text-[12px] font-medium ${selected ? "text-[#185FA5]" : "text-[#18181B]"}`}>
                      V.{item.week_number}
                    </p>
                    <p className="text-[10px] text-[#71717A]">
                      {item.isVirtualDraft ? `v.${currentWeekNumber} utkast` : item.sent_at ? fmtShort(item.sent_at) : "Utkast"}
                    </p>
                  </div>
                  <span
                    className={`rounded-[10px] px-[7px] py-[2px] text-[9px] font-medium ${
                      item.status === "sent"
                        ? "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]"
                        : "bg-[rgba(239,159,39,0.12)] text-[#854F0B]"
                    }`}
                  >
                    {item.status === "sent" ? "Skickad" : "Utkast"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
          <div className="flex items-center justify-between border-b border-[#F4F4F5] bg-[#FAFAFA] px-[13px] py-[10px]">
            <div>
              <p className="text-[12px] font-medium text-[#18181B]">Redigera rapport · v.{selectedData.week_number}</p>
              <p className="text-[10px] text-[#71717A]">{weekLabel}</p>
            </div>
            <span className="rounded-[10px] bg-[rgba(83,74,183,0.12)] px-[7px] py-[2px] text-[9px] font-medium text-[#534AB7]">
              AI-genererad
            </span>
          </div>

          <div className="flex-1 space-y-[12px] overflow-y-auto p-[14px]">
            <div>
              <p className="mb-[6px] text-[10px] uppercase tracking-[0.4px] text-[#71717A]">NYCKELTAL (AUTO)</p>
              <div className="mb-[6px] grid grid-cols-3 gap-[7px]">
                {[
                  { val: selectedData.meetings_week, label: "Möten veckan" },
                  { val: selectedData.meetings_mtd, label: "MTD totalt" },
                  { val: selectedData.meetings_total, label: "Totalt kampanj" },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-[6px] bg-[#F4F4F5] px-[10px] py-[7px] text-center">
                    <p className="text-[15px] font-medium text-[#18181B]">{kpi.val}</p>
                    <p className="mt-[2px] text-[9px] text-[#71717A]">{kpi.label}</p>
                  </div>
                ))}
              </div>
              <span className={`inline-flex items-center gap-[5px] rounded-[20px] px-[9px] py-[3px] text-[11px] ${paceBadge.cls}`}>
                {paceBadge.label}
              </span>
            </div>

            <div>
              <p className="mb-[6px] text-[10px] uppercase tracking-[0.4px] text-[#71717A]">AKTIVITETSSAMMANFATTNING (AUTO)</p>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-[#FAFAFA]">
                    {["Kanal", "Volym", "Utfall", "Möten"].map((h) => (
                      <th key={h} className="px-[8px] py-[6px] text-left text-[9px] uppercase tracking-[0.4px] text-[#71717A]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { kanal: "Telefon", vol: `${thisWeekActivity.dials} dials`, utf: `${thisWeekActivity.connects} connects`, moten: meetingsByPhone },
                    { kanal: "Email", vol: `${thisWeekActivity.emails_sent} skickade`, utf: `${thisWeekActivity.replies} svar`, moten: meetingsByEmail },
                    {
                      kanal: "LinkedIn",
                      vol: `${thisWeekActivity.linkedin_requests} förfrågn.`,
                      utf: `${thisWeekActivity.linkedin_accepted} accept.`,
                      moten: meetingsByLI,
                    },
                  ].map((row) => (
                    <tr key={row.kanal} className="border-b border-[#F4F4F5]">
                      <td className="px-[8px] py-[6px] text-[#18181B]">{row.kanal}</td>
                      <td className="px-[8px] py-[6px] text-[#71717A]">{row.vol}</td>
                      <td className="px-[8px] py-[6px] text-[#71717A]">{row.utf}</td>
                      <td className="px-[8px] py-[6px] font-medium text-[#185FA5]">{row.moten}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <p className="mb-[6px] text-[10px] uppercase tracking-[0.4px] text-[#71717A]">AI-KOMMENTAR (REDIGERBAR)</p>
              {aiCommentary ? (
                <div className="relative rounded-[6px] border border-[rgba(83,74,183,0.18)] bg-[rgba(83,74,183,0.04)] p-[11px]">
                  <span className="absolute right-0 top-0 rounded-bl-[6px] rounded-tr-[6px] bg-[#534AB7] px-[7px] py-[2px] text-[9px] font-medium text-white">
                    Claude
                  </span>
                  <textarea
                    value={aiCommentary}
                    onChange={(e) => setAiCommentary(e.target.value)}
                    rows={5}
                    className="w-full resize-none bg-transparent text-[12px] leading-[1.65] text-[#18181B] outline-none"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={generateAI}
                  disabled={generating}
                  className="rounded-[6px] border border-[#E4E4E7] bg-white px-[10px] py-[6px] text-[11px] text-[#71717A] hover:bg-[#FAFAFA] disabled:opacity-60"
                >
                  {generating ? "Genererar…" : "Generera AI-kommentar"}
                </button>
              )}
            </div>

            <div>
              <p className="mb-[6px] text-[10px] uppercase tracking-[0.4px] text-[#71717A]">NÄSTA VECKAS FOKUS</p>
              <textarea
                value={nextWeekFocus}
                onChange={(e) => setNextWeekFocus(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-[6px] border border-[#E4E4E7] bg-[#FAFAFA] px-[9px] py-[7px] text-[12px] text-[#18181B] outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#F4F4F5] bg-[#FAFAFA] px-[13px] py-[10px]">
            <p className="text-[11px] text-[#71717A]">Till: {clientName} rapport@brightvision.com</p>
            <div className="flex gap-[6px]">
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving || sending}
                className="rounded-[6px] border border-[#E4E4E7] bg-white px-[10px] py-[5px] text-[11px] text-[#71717A] disabled:opacity-60"
              >
                {saving ? "Sparar..." : "Spara utkast"}
              </button>
              <button
                type="button"
                onClick={sendReport}
                disabled={saving || sending}
                className="rounded-[6px] border border-[#0F6E56] bg-[#0F6E56] px-[10px] py-[5px] text-[11px] text-white disabled:opacity-60"
              >
                {sending ? "Skickar..." : "Skicka rapport →"}
              </button>
            </div>
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
          <div className="border-b border-[#F4F4F5] bg-[#FAFAFA] px-[13px] py-[10px]">
            <p className="text-[12px] font-medium text-[#18181B]">Förhandsvisning · klientformat</p>
            <p className="text-[10px] text-[#71717A]">Som kunden ser det</p>
          </div>
          <div className="flex-1 overflow-y-auto p-[14px]">
            <h3 className="text-[16px] font-medium text-[#18181B]">Brightvision</h3>
            <div className="my-[5px] h-[2px] w-[36px] bg-[#185FA5]" />
            <p className="text-[17px] font-medium text-[#18181B]">Veckorapport v.{selectedData.week_number}</p>
            <p className="text-[11px] text-[#71717A]">
              {clientName} · {weekLabel}
            </p>

            <div className="mb-[14px] mt-[10px] grid grid-cols-3 gap-[7px]">
              {[
                { val: selectedData.meetings_week, label: "Möten veckan" },
                { val: selectedData.meetings_mtd, label: "MTD totalt" },
                { val: selectedData.meetings_total, label: "Totalt kampanj" },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-[7px] bg-[#F4F4F5] px-[11px] py-[9px] text-center">
                  <p className="text-[19px] font-medium text-[#185FA5]">{kpi.val}</p>
                  <p className="mt-[2px] text-[9px] text-[#71717A]">{kpi.label}</p>
                </div>
              ))}
            </div>

            <p className="mb-[5px] mt-[12px] text-[10px] font-medium uppercase text-[#71717A]">SAMMANFATTNING</p>
            <p className="text-[12px] leading-[1.65] text-[#18181B]">
              {aiCommentary || "Ingen AI-kommentar tillagd ännu för denna vecka."}
            </p>

            <p className="mb-[5px] mt-[12px] text-[10px] font-medium uppercase text-[#71717A]">AKTIVITET PER KANAL</p>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-[#FAFAFA]">
                  {["Kanal", "Volym", "Utfall", "Möten"].map((h) => (
                    <th key={h} className="px-[8px] py-[6px] text-left text-[9px] uppercase tracking-[0.4px] text-[#71717A]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { kanal: "Telefon", vol: `${thisWeekActivity.dials} dials`, utf: `${thisWeekActivity.connects} connects`, moten: meetingsByPhone },
                  { kanal: "Email", vol: `${thisWeekActivity.emails_sent} skickade`, utf: `${thisWeekActivity.replies} svar`, moten: meetingsByEmail },
                  {
                    kanal: "LinkedIn",
                    vol: `${thisWeekActivity.linkedin_requests} förfrågn.`,
                    utf: `${thisWeekActivity.linkedin_accepted} accept.`,
                    moten: meetingsByLI,
                  },
                ].map((row) => (
                  <tr key={row.kanal} className="border-b border-[#F4F4F5]">
                    <td className="px-[8px] py-[6px] text-[#18181B]">{row.kanal}</td>
                    <td className="px-[8px] py-[6px] text-[#71717A]">{row.vol}</td>
                    <td className="px-[8px] py-[6px] text-[#71717A]">{row.utf}</td>
                    <td className="px-[8px] py-[6px] font-medium text-[#185FA5]">{row.moten}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mb-[5px] mt-[12px] text-[10px] font-medium uppercase text-[#71717A]">NÄSTA VECKA</p>
            <p className="text-[12px] leading-[1.65] text-[#18181B]">{nextWeekFocus || "Inget fokus satt ännu."}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
