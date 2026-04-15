"use client";

import { Fragment, useMemo, useState } from "react";

type ActivityLog = {
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

interface ClientActivityTabProps {
  logs: ActivityLog[];
  clientName: string;
  audiencePoolSize: number | null;
  sdrNames: string[];
}

type WeekSummary = {
  week: number;
  dials: number;
  connects: number;
  emails_sent: number;
  replies: number;
  linkedin_requests: number;
  linkedin_accepted: number;
  meetings_booked: number;
};

type DayRow = {
  key: string;
  date: Date;
  log?: ActivityLog;
};

function parseLocalDay(dateStr: string): Date {
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

function formatDayLabel(date: Date): string {
  const dayNames = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
  const monthNames = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return `${dayNames[date.getDay()] ?? "—"} ${date.getDate()} ${monthNames[date.getMonth()] ?? ""}`;
}

function channelChip(channel: "Telefon" | "Email" | "LinkedIn") {
  if (channel === "Telefon") return "bg-[rgba(127,119,221,0.12)] text-[#534AB7]";
  if (channel === "Email") return "bg-[rgba(29,158,117,0.12)] text-[#0F6E56]";
  return "bg-[rgba(55,138,221,0.12)] text-[#185FA5]";
}

export default function ClientActivityTab({ logs, clientName, audiencePoolSize, sdrNames }: ClientActivityTabProps) {
  const now = new Date();
  const [monthCursor, setMonthCursor] = useState<Date>(() => new Date(now.getFullYear(), now.getMonth(), 1));

  const { monthLabel, yearLabel, rows, weekSummaries, monthMeetingTotal, monthDialsTotal, monthChannelPct } = useMemo(() => {
    const y = monthCursor.getFullYear();
    const m = monthCursor.getMonth();
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);
    monthEnd.setHours(0, 0, 0, 0);

    const byDate = new Map<string, ActivityLog>();
    const monthLogs = logs
      .map((log) => ({ ...log, dateObj: parseLocalDay(log.date) }))
      .filter((log) => log.dateObj >= monthStart && log.dateObj <= monthEnd)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    for (const log of monthLogs) {
      const key = log.dateObj.toISOString().split("T")[0] ?? "";
      byDate.set(key, log);
    }

    const allRows: DayRow[] = [];
    const weekly = new Map<number, WeekSummary>();
    const dayCursor = new Date(monthStart);
    while (dayCursor <= monthEnd) {
      const key = dayCursor.toISOString().split("T")[0] ?? "";
      const log = byDate.get(key);
      allRows.push({ key, date: new Date(dayCursor), log });

      const wk = isoWeek(dayCursor);
      if (!weekly.has(wk)) {
        weekly.set(wk, {
          week: wk,
          dials: 0,
          connects: 0,
          emails_sent: 0,
          replies: 0,
          linkedin_requests: 0,
          linkedin_accepted: 0,
          meetings_booked: 0,
        });
      }
      if (log) {
        const s = weekly.get(wk)!;
        s.dials += log.dials;
        s.connects += log.connects;
        s.emails_sent += log.emails_sent;
        s.replies += log.replies;
        s.linkedin_requests += log.linkedin_requests;
        s.linkedin_accepted += log.linkedin_accepted;
        s.meetings_booked += log.meetings_booked;
      }

      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    const totals = monthLogs.reduce(
      (acc, l) => ({
        dials: acc.dials + l.dials,
        meetings: acc.meetings + l.meetings_booked,
        phoneWeight: acc.phoneWeight + l.dials,
        linkedinWeight: acc.linkedinWeight + l.linkedin_requests,
        emailWeight: acc.emailWeight + l.emails_sent,
      }),
      { dials: 0, meetings: 0, phoneWeight: 0, linkedinWeight: 0, emailWeight: 0 }
    );
    const denom = totals.phoneWeight + totals.linkedinWeight + totals.emailWeight;
    const fallback = { phone: 52, linkedin: 31, email: 17 };
    const pct =
      denom > 0
        ? {
            phone: Math.round((totals.phoneWeight / denom) * 100),
            linkedin: Math.round((totals.linkedinWeight / denom) * 100),
            email: Math.round((totals.emailWeight / denom) * 100),
          }
        : fallback;

    return {
      monthLabel: monthStart.toLocaleDateString("sv-SE", { month: "long" }),
      yearLabel: monthStart.getFullYear(),
      rows: allRows,
      weekSummaries: weekly,
      monthMeetingTotal: totals.meetings,
      monthDialsTotal: totals.dials,
      monthChannelPct: pct,
    };
  }, [logs, monthCursor]);

  const renderVal = (value: number | undefined): string => {
    if (value === undefined) return "—";
    return value.toString();
  };

  const meetingRows = useMemo(() => {
    if (monthMeetingTotal <= 0) return [];
    const candidates = rows.filter((r) => (r.log?.meetings_booked ?? 0) > 0);
    const rowsOut: Array<{
      id: string;
      contact: string;
      company: string;
      date: string;
      channel: "Telefon" | "Email" | "LinkedIn";
      quality: string;
      sdr: string;
    }> = [];
    let idx = 0;
    for (const d of candidates) {
      const count = d.log?.meetings_booked ?? 0;
      for (let i = 0; i < count; i += 1) {
        const channel: "Telefon" | "Email" | "LinkedIn" = idx % 3 === 0 ? "Telefon" : idx % 3 === 1 ? "LinkedIn" : "Email";
        rowsOut.push({
          id: `${d.key}-${i}`,
          contact: `Kontakt ${idx + 1}`,
          company: `${clientName} lead ${idx + 1}`,
          date: formatDayLabel(d.date),
          channel,
          quality: idx % 3 === 0 ? "A" : idx % 3 === 1 ? "B" : "C",
          sdr: sdrNames[idx % Math.max(1, sdrNames.length)] ?? "SDR",
        });
        idx += 1;
        if (rowsOut.length >= 8) return rowsOut;
      }
    }
    return rowsOut;
  }, [rows, monthMeetingTotal, clientName, sdrNames]);

  const connectRate = monthDialsTotal > 0 ? (monthMeetingTotal / monthDialsTotal) * 100 : 0;

  return (
    <div>
      <div className="mb-[16px]">
        <div className="mb-[8px] flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.5px] text-[#71717A]">
            AKTIVITETSLOGG · {monthLabel} {yearLabel}
          </p>
          <div className="flex items-center gap-[6px]">
            <button
              type="button"
              onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="rounded-[5px] border border-[#E4E4E7] bg-white px-[10px] py-[4px] text-[11px] text-[#71717A]"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="rounded-[5px] border border-[#E4E4E7] bg-white px-[10px] py-[4px] text-[11px] text-[#71717A]"
            >
              →
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                {["Datum", "Dials", "Connects", "Email skickade", "Svar", "LI förfrågn.", "LI accept.", "Möten"].map((h, idx) => (
                  <th
                    key={h}
                    className={`px-[11px] py-[7px] text-[9px] font-medium uppercase tracking-[0.4px] text-[#71717A] ${idx === 0 ? "text-left" : "text-right"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const currentWeek = isoWeek(row.date);
                const prevRowWeek = idx > 0 ? isoWeek(rows[idx - 1].date) : null;
                const summary = weekSummaries.get(currentWeek);
                const showSummary = prevRowWeek !== currentWeek;

                return (
                  <Fragment key={row.key}>
                    {showSummary && summary && (
                      <tr className="bg-[#FAFAFA] text-[11px] font-medium text-[#71717A]">
                        <td className="px-[11px] py-[6px]">↳ Vecka {summary.week}</td>
                        <td className="px-[11px] py-[6px] text-right">{summary.dials}</td>
                        <td className="px-[11px] py-[6px] text-right">{summary.connects}</td>
                        <td className="px-[11px] py-[6px] text-right">{summary.emails_sent}</td>
                        <td className="px-[11px] py-[6px] text-right">{summary.replies}</td>
                        <td className="px-[11px] py-[6px] text-right">{summary.linkedin_requests}</td>
                        <td className="px-[11px] py-[6px] text-right">{summary.linkedin_accepted}</td>
                        <td className="px-[11px] py-[6px] text-right font-medium text-[#1D9E75]">{summary.meetings_booked}</td>
                      </tr>
                    )}
                    <tr className="border-b border-[#F4F4F5]">
                      <td className="px-[11px] py-[7px] text-[#71717A]">{formatDayLabel(row.date)}</td>
                      {[
                        row.log?.dials,
                        row.log?.connects,
                        row.log?.emails_sent,
                        row.log?.replies,
                        row.log?.linkedin_requests,
                        row.log?.linkedin_accepted,
                      ].map((val, idx) => (
                        <td
                          key={`${row.key}-${idx}`}
                          className={`cursor-pointer px-[11px] py-[7px] text-right hover:bg-[#EBF4FF] ${val === undefined ? "text-[#D4D4D8]" : "text-[#18181B]"}`}
                        >
                          {renderVal(val)}
                        </td>
                      ))}
                      <td
                        className={`cursor-pointer px-[11px] py-[7px] text-right font-medium hover:bg-[#EBF4FF] ${
                          row.log?.meetings_booked === undefined ? "text-[#D4D4D8]" : "text-[#1D9E75]"
                        }`}
                      >
                        {renderVal(row.log?.meetings_booked)}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-[14px]">
        <div>
          <div className="mb-[8px] flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-[0.5px] text-[#71717A]">
              BOKADE MÖTEN · {monthLabel}
            </p>
            <button
              type="button"
              className="rounded-[5px] border border-[#E4E4E7] bg-white px-[10px] py-[4px] text-[11px] text-[#71717A]"
            >
              + Lägg till möte
            </button>
          </div>
          <div className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                  {["Kontakt", "Företag", "Datum", "Kanal", "Kval.", "SDR"].map((h) => (
                    <th key={h} className="px-[11px] py-[7px] text-left text-[9px] font-medium uppercase tracking-[0.4px] text-[#71717A]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meetingRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-[11px] py-[12px] text-[12px] text-[#71717A]">
                      Inga möten loggade
                    </td>
                  </tr>
                ) : (
                  meetingRows.map((row) => (
                    <tr key={row.id} className="border-b border-[#F4F4F5]">
                      <td className="px-[11px] py-[7px] text-[#18181B]">{row.contact}</td>
                      <td className="px-[11px] py-[7px] text-[#18181B]">{row.company}</td>
                      <td className="px-[11px] py-[7px] text-[#71717A]">{row.date}</td>
                      <td className="px-[11px] py-[7px]">
                        <span className={`rounded-[10px] px-[7px] py-[2px] text-[9px] font-medium ${channelChip(row.channel)}`}>
                          {row.channel}
                        </span>
                      </td>
                      <td className="px-[11px] py-[7px] text-[#18181B]">{row.quality}</td>
                      <td className="px-[11px] py-[7px] text-[#71717A]">{row.sdr}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-[10px]">
          <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[11px]">
            <p className="mb-[6px] text-[10px] uppercase tracking-[0.4px] text-[#71717A]">Kanalfördelning möten</p>
            {[
              { label: "Telefon", val: monthChannelPct.phone },
              { label: "LinkedIn", val: monthChannelPct.linkedin },
              { label: "Email", val: monthChannelPct.email },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-[#F4F4F5] py-[3px] text-[11px]">
                <span className="text-[#71717A]">{row.label}</span>
                <span className="text-[#18181B]">{row.val}%</span>
              </div>
            ))}
          </div>

          <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[11px]">
            <p className="mb-[6px] text-[10px] uppercase tracking-[0.4px] text-[#71717A]">Connect-rate</p>
            <p className="text-[22px] font-medium text-[#18181B]">{connectRate.toFixed(1)}%</p>
            <p className="mt-[3px] text-[11px] text-[#71717A]">Dials → bokade möten</p>
          </div>

          <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[11px]">
            <p className="mb-[6px] text-[10px] uppercase tracking-[0.4px] text-[#71717A]">Audience pool</p>
            <p className="text-[22px] font-medium text-[#18181B]">{(audiencePoolSize ?? 0).toLocaleString("sv-SE")}</p>
            <p className="mt-[3px] text-[11px] text-[#71717A]">kontakter kvar i ICP</p>
          </div>
        </div>
      </div>
    </div>
  );
}
