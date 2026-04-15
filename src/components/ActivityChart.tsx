"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ActivityChartLog = {
  date: string;
  dials: number;
  connects: number;
  emails_sent: number;
  meetings_booked: number;
};

export interface ActivityChartProps {
  logs: ActivityChartLog[];
}

function getWeekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

function parseLogDate(dateStr: string): Date {
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

const COL_DIALS = "#534AB7";
const COL_EMAIL = "#1D9E75";
const COL_MEETINGS = "#0D9488";

type Row = {
  weekKey: string;
  weekLabel: string;
  dials: number;
  emails_sent: number;
  meetings_booked: number;
};

export default function ActivityChart({ logs }: ActivityChartProps) {
  const data = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - 27);

    const currentMonday = getWeekStart(today);
    const weekStarts: Date[] = [];
    for (let i = 3; i >= 0; i -= 1) {
      const ws = new Date(currentMonday);
      ws.setDate(ws.getDate() - i * 7);
      weekStarts.push(ws);
    }

    const byKey = new Map<string, Row>();
    for (const ws of weekStarts) {
      const key = ws.getTime().toString();
      byKey.set(key, {
        weekKey: key,
        weekLabel: `v.${isoWeek(ws)}`,
        dials: 0,
        emails_sent: 0,
        meetings_booked: 0,
      });
    }

    for (const log of logs) {
      const logDate = parseLogDate(log.date);
      if (logDate < windowStart || logDate > today) continue;
      const ws = getWeekStart(logDate);
      const key = ws.getTime().toString();
      const row = byKey.get(key);
      if (!row) continue;
      row.dials += log.dials;
      row.emails_sent += log.emails_sent;
      row.meetings_booked += log.meetings_booked;
    }

    return weekStarts.map((ws) => byKey.get(ws.getTime().toString())!);
  }, [logs]);

  return (
    <div className="rounded-[8px] border border-zinc-200 bg-white px-[10px] pt-[10px] pb-[6px]">
      <p className="mb-[6px] text-[11px] font-medium text-zinc-700 leading-tight">Aktivitet (4 veckor)</p>
      <div className="h-[180px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 2, right: 4, left: -18, bottom: 0 }}
            barCategoryGap="18%"
            barGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
            <XAxis
              dataKey="weekLabel"
              tick={{ fontSize: 10, fill: "#71717A" }}
              axisLine={{ stroke: "#E4E4E7" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#71717A" }}
              axisLine={false}
              tickLine={false}
              width={28}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #E4E4E7",
              }}
              labelStyle={{ fontSize: 10, color: "#52525B", marginBottom: 2 }}
            />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconType="circle" iconSize={6} />
            <Bar dataKey="dials" name="Dials" fill={COL_DIALS} radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="emails_sent" name="Email" fill={COL_EMAIL} radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="meetings_booked" name="Möten" fill={COL_MEETINGS} radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
