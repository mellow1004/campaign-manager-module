"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  campaignId: string;
  todayStr: string; // "YYYY-MM-DD"
  todayLog?: {
    dials: number;
    connects: number;
    emails_sent: number;
    replies: number;
    linkedin_requests: number;
    linkedin_accepted: number;
    meetings_booked: number;
  } | null;
}

export default function ActivityLogForm({ campaignId, todayStr, todayLog }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id:        campaignId,
        date:               fd.get("date"),
        dials:              Number(fd.get("dials")),
        connects:           Number(fd.get("connects")),
        emails_sent:        Number(fd.get("emails_sent")),
        replies:            Number(fd.get("replies")),
        linkedin_requests:  Number(fd.get("linkedin_requests")),
        linkedin_accepted:  Number(fd.get("linkedin_accepted")),
        meetings_booked:    Number(fd.get("meetings_booked")),
      }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setOpen(false);
    startTransition(() => router.refresh());
  }

  const fields = [
    { name: "dials",              label: "Dials",         defaultVal: todayLog?.dials ?? 0 },
    { name: "connects",           label: "Connects",      defaultVal: todayLog?.connects ?? 0 },
    { name: "emails_sent",        label: "Email skickade",defaultVal: todayLog?.emails_sent ?? 0 },
    { name: "replies",            label: "Svar",          defaultVal: todayLog?.replies ?? 0 },
    { name: "linkedin_requests",  label: "LI förfr.",     defaultVal: todayLog?.linkedin_requests ?? 0 },
    { name: "linkedin_accepted",  label: "LI accept.",    defaultVal: todayLog?.linkedin_accepted ?? 0 },
    { name: "meetings_booked",    label: "Möten bokade",  defaultVal: todayLog?.meetings_booked ?? 0 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-zinc-400">
            Aktivitetslogg
          </p>
          {saved && (
            <span className="rounded-[4px] bg-[rgba(29,158,117,0.1)] px-[6px] py-[1px] text-[10px] text-[#0F6E56]">
              ✓ Sparat
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-[6px] border border-[#1D9E75] bg-[rgba(29,158,117,0.07)] px-3 py-[5px] text-[11px] font-medium text-[#1D9E75] hover:bg-[rgba(29,158,117,0.15)]"
        >
          {open ? "Avbryt" : todayLog ? "✎ Uppdatera idag" : "+ Logga aktivitet"}
        </button>
      </div>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mb-3 rounded-[8px] border border-zinc-200 bg-white px-4 py-3"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-medium text-zinc-700">
              {todayLog ? "Uppdatera aktivitet" : "Logga aktivitet"}
            </p>
            <input
              name="date"
              type="date"
              defaultValue={todayStr}
              className="rounded-[5px] border border-zinc-200 px-2 py-[4px] text-[11px] focus:border-[#1D9E75] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-4 gap-3 mb-3">
            {fields.map(({ name, label, defaultVal }) => (
              <div key={name}>
                <label className="block text-[10px] text-zinc-400 mb-[3px]">{label}</label>
                <input
                  name={name}
                  type="number"
                  min="0"
                  defaultValue={defaultVal}
                  className="w-full rounded-[5px] border border-zinc-200 px-2 py-[5px] text-[12px] text-right font-medium focus:border-[#1D9E75] focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[5px] border border-zinc-200 px-3 py-[5px] text-[11px] text-zinc-500 hover:bg-zinc-50"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[5px] bg-[#1D9E75] px-4 py-[5px] text-[11px] font-medium text-white hover:bg-[#178F68] disabled:opacity-50"
            >
              {saving ? "Sparar…" : "Spara logg"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
