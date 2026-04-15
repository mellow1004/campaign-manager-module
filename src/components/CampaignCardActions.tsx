"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export interface CampaignCardActionsProps {
  campaignId: string;
  clientName: string;
}

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const btnBase =
  "rounded-[6px] px-[10px] py-[6px] text-[11px] font-medium leading-tight transition border";

export default function CampaignCardActions({
  campaignId,
  clientName,
}: CampaignCardActionsProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dials, setDials] = useState(0);
  const [connects, setConnects] = useState(0);
  const [emailsSent, setEmailsSent] = useState(0);
  const [replies, setReplies] = useState(0);
  const [linkedinRequests, setLinkedinRequests] = useState(0);
  const [linkedinAccepted, setLinkedinAccepted] = useState(0);
  const [meetingsBooked, setMeetingsBooked] = useState(0);

  const openForm = useCallback(() => {
    setError(null);
    setDials(0);
    setConnects(0);
    setEmailsSent(0);
    setReplies(0);
    setLinkedinRequests(0);
    setLinkedinAccepted(0);
    setMeetingsBooked(0);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setError(null);
  }, []);

  const handleReport = useCallback(() => {
    router.push(`/dashboard/${campaignId}?tab=rapporter`);
  }, [router, campaignId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          date: todayIsoLocal(),
          dials,
          connects,
          emails_sent: emailsSent,
          replies,
          linkedin_requests: linkedinRequests,
          linkedin_accepted: linkedinAccepted,
          meetings_booked: meetingsBooked,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Kunde inte spara");
        return;
      }
      closeForm();
      router.refresh();
    } catch {
      setError("Nätverksfel");
    } finally {
      setSubmitting(false);
    }
  };

  const numInputCls =
    "w-full rounded-[4px] border border-zinc-200 bg-white px-[8px] py-[5px] text-[11px] text-zinc-900 tabular-nums outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]/30";

  return (
    <div className="mt-[8px] border-t border-[#F4F4F5] pt-[8px]">
      <p className="sr-only">Snabbåtgärder för {clientName}</p>

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-[8px]">
          <p className="text-[11px] font-medium text-zinc-700 leading-tight">
            Logga aktivitet · <span className="text-zinc-500 font-normal">{clientName}</span>
          </p>
          <div className="grid grid-cols-2 gap-[6px]">
            {(
              [
                { id: "dials", label: "Dials", value: dials, set: setDials },
                { id: "connects", label: "Connects", value: connects, set: setConnects },
                { id: "emails_sent", label: "Email skickade", value: emailsSent, set: setEmailsSent },
                { id: "replies", label: "Svar", value: replies, set: setReplies },
                {
                  id: "linkedin_requests",
                  label: "LI-förfrågningar",
                  value: linkedinRequests,
                  set: setLinkedinRequests,
                },
                {
                  id: "linkedin_accepted",
                  label: "LI-accept",
                  value: linkedinAccepted,
                  set: setLinkedinAccepted,
                },
                {
                  id: "meetings_booked",
                  label: "Möten bokade",
                  value: meetingsBooked,
                  set: setMeetingsBooked,
                },
              ] as const
            ).map(({ id, label, value, set }) => (
              <label key={id} className={`block ${id === "meetings_booked" ? "col-span-2" : ""}`}>
                <span className="mb-[2px] block text-[10px] text-zinc-500 leading-tight">{label}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className={numInputCls}
                  value={Number.isNaN(value) ? "" : value}
                  onChange={(ev) => set(Math.max(0, Number.parseInt(ev.target.value, 10) || 0))}
                />
              </label>
            ))}
          </div>
          {error && <p className="text-[10px] text-[#E24B4A] leading-tight">{error}</p>}
          <div className="flex gap-[6px]">
            <button
              type="submit"
              disabled={submitting}
              className={`${btnBase} flex-1 border-[#1D9E75] bg-[#1D9E75] text-white hover:bg-[#188a66] disabled:opacity-50`}
            >
              {submitting ? "Sparar…" : "Spara"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={submitting}
              className={`${btnBase} border-zinc-200 bg-[#F4F4F5] text-zinc-600 hover:bg-zinc-100`}
            >
              Avbryt
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-[6px]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openForm();
            }}
            className={`${btnBase} flex-1 border-[#1D9E75] bg-[rgba(29,158,117,0.08)] text-[#0F6E56] hover:bg-[rgba(29,158,117,0.14)]`}
          >
            Logga aktivitet
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleReport();
            }}
            className={`${btnBase} flex-1 border-[#1D9E75] bg-[#1D9E75] text-white hover:bg-[#188a66]`}
          >
            Generera rapport
          </button>
        </div>
      )}
    </div>
  );
}
