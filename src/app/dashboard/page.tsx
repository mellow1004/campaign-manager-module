import { CampaignStatus } from "@prisma/client";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { prisma } from "@/lib/prisma";

type HealthLevel = "green" | "yellow" | "red";

const STATUS_LABELS: Record<CampaignStatus, string> = {
  onboarding: "Onboarding",
  active: "Aktiv",
  paused: "Pausad",
  closing: "Avslutar",
  closed: "Avslutad",
};

const CHANNEL_LABELS: Record<string, string> = {
  phone: "Telefon",
  email: "Email",
  linkedin: "LinkedIn",
};

function getStartOfWeek(date: Date): Date {
  const copy = new Date(date);
  const weekday = copy.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getIsoWeekNumber(date: Date): number {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function toMidnight(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getDaysUntilNextTuesday(date: Date): number {
  const weekday = date.getDay();
  const targetWeekday = 2;
  return (targetWeekday - weekday + 7) % 7;
}

function formatTopbarDate(date: Date): string {
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  const capitalized = `${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}`;
  return `${capitalized} · v.${getIsoWeekNumber(date)}`;
}

function getHealthLevel(score: number): HealthLevel {
  if (score < 40) {
    return "red";
  }
  if (score < 75) {
    return "yellow";
  }
  return "green";
}

function healthDotClass(level: HealthLevel): string {
  if (level === "green") {
    return "bg-[#1D9E75]";
  }
  if (level === "yellow") {
    return "bg-[#EF9F27]";
  }
  return "bg-[#E24B4A]";
}

function progressIndicatorClass(progress: number): string {
  if (progress < 40) {
    return "bg-rose-500";
  }
  if (progress < 75) {
    return "bg-amber-500";
  }
  return "bg-emerald-600";
}

function statusClass(status: CampaignStatus): string {
  switch (status) {
    case "active":
      return "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]";
    case "paused":
      return "bg-zinc-100 text-zinc-700";
    case "onboarding":
      return "bg-sky-100 text-sky-800";
    case "closing":
      return "bg-amber-100 text-amber-800";
    case "closed":
      return "bg-zinc-100 text-zinc-600";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

export default async function DashboardPage() {
  const today = toMidnight(new Date());
  const weekStart = getStartOfWeek(today);
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(weekStart);
  previousWeekEnd.setMilliseconds(previousWeekEnd.getMilliseconds() - 1);
  const reportDaysLeft = getDaysUntilNextTuesday(today);

  const [campaigns, loggedPm] = await Promise.all([
    prisma.campaign.findMany({
      include: {
        activity_logs: {
          where: {
            date: {
              gte: previousWeekStart,
              lte: today,
            },
          },
          select: {
            date: true,
            meetings_booked: true,
          },
        },
      },
      orderBy: {
        client_name: "asc",
      },
    }),
    prisma.user.findFirst({
      where: {
        role: "pm",
      },
      select: {
        name: true,
        avatar_initials: true,
      },
    }),
  ]);

  const campaignCards = campaigns.map((campaign) => {
    const meetingsThisWeek = campaign.activity_logs
      .filter((log) => log.date >= weekStart)
      .reduce((sum, log) => sum + log.meetings_booked, 0);
    const meetingsLastWeek = campaign.activity_logs
      .filter((log) => log.date >= previousWeekStart && log.date <= previousWeekEnd)
      .reduce((sum, log) => sum + log.meetings_booked, 0);

    return {
      campaign,
      meetingsThisWeek,
      meetingsLastWeek,
    };
  });

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;
  const pausedCampaigns = campaigns.filter((campaign) => campaign.status === "paused").length;
  const closingCampaigns = campaigns.filter((campaign) => campaign.status === "closing").length;
  const reportsToSend = campaigns.filter((campaign) => campaign.status === "active" && campaign.health_score < 75).length;
  const totalMeetingsThisWeek = campaignCards.reduce((sum, card) => sum + card.meetingsThisWeek, 0);
  const totalMeetingsLastWeek = campaignCards.reduce((sum, card) => sum + card.meetingsLastWeek, 0);
  const meetingDelta = totalMeetingsThisWeek - totalMeetingsLastWeek;
  const averageHealth = campaigns.length > 0
    ? Math.round(campaigns.reduce((sum, campaign) => sum + campaign.health_score, 0) / campaigns.length)
    : 0;
  const redCampaigns = campaigns.filter((campaign) => campaign.health_score < 40).length;

  return (
    <div className="flex min-h-screen overflow-hidden bg-[#F4F4F5] text-zinc-900">
      <aside className="hidden w-[200px] shrink-0 flex-col bg-[#18181B] md:flex">
        <div className="border-b border-white/10 px-4 pt-[18px] pb-3">
          <p className="text-[15px] font-medium text-white">Otto</p>
          <p className="mt-0.5 text-[10px] text-white/35">CoSeller Suite</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3 text-[12px]">
          <div className="flex items-center gap-2 rounded-md bg-[rgba(29,158,117,0.2)] px-[10px] py-2 text-[#3ECFA0]">
            ▦ Dashboard
          </div>
          <div className="flex items-center gap-2 rounded-md px-[10px] py-2 text-white/50">
            ◈ Kampanjer
            <span className="ml-auto rounded-full bg-[rgba(226,75,74,0.25)] px-1.5 py-0.5 text-[10px] text-[#F09595]">
              12
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md px-[10px] py-2 text-white/50">
            ✓ Mina todos
            <span className="ml-auto rounded-full bg-[rgba(226,75,74,0.25)] px-1.5 py-0.5 text-[10px] text-[#F09595]">
              5
            </span>
          </div>
          <div className="rounded-md px-[10px] py-2 text-white/50">↗ Rapporter</div>
          <div className="rounded-md px-[10px] py-2 text-white/50">≡ Checklistor</div>
          <div className="rounded-md px-[10px] py-2 text-white/50">⚙ ICP-bibliotek</div>
        </nav>
        <div className="flex items-center gap-2 border-t border-white/10 px-3.5 py-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1D9E75] text-[10px] font-medium text-white">
            {loggedPm?.avatar_initials ?? "PM"}
          </div>
          <div>
            <p className="text-[11px] text-white/70">{loggedPm?.name ?? "Project Manager"}</p>
            <p className="text-[10px] text-white/35">Project Manager</p>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[50px] items-center justify-between border-b border-zinc-200 bg-white px-5">
          <div>
            <h1 className="text-sm font-medium text-[#18181B]">Kampanjöversikt</h1>
            <p className="text-[11px] text-zinc-500">{formatTopbarDate(today)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="cursor-pointer rounded-md border border-[#1D9E75] bg-[rgba(29,158,117,0.07)] px-2.5 py-1 text-[11px] text-[#1D9E75]">
              Alla
            </button>
            <button className="cursor-pointer rounded-md border border-zinc-200 bg-[#F4F4F5] px-2.5 py-1 text-[11px] text-zinc-500">
              Aktiva
            </button>
            <button className="cursor-pointer rounded-md border border-zinc-200 bg-[#F4F4F5] px-2.5 py-1 text-[11px] text-zinc-500">
              ⚠ Kräver åtgärd
            </button>
          </div>
        </header>

        <section className="bg-[#F4F4F5] px-5 py-2">
          <div className="overflow-x-auto">
            <div className="flex min-w-[820px] divide-x divide-zinc-200 rounded-md border border-zinc-200 bg-white">
              <div className="w-1/4 px-3 py-2">
                <p className="text-[10px] tracking-[0.3px] text-zinc-500 uppercase">Aktiva kampanjer</p>
                <p className="text-[20px] leading-5 font-medium text-[#18181B]">{campaigns.length}</p>
                <p className="text-[10px] text-zinc-500">
                  {activeCampaigns} aktiva · {pausedCampaigns} pausade · {closingCampaigns} avslutar
                </p>
              </div>
              <div className="w-1/4 px-3 py-2">
                <p className="text-[10px] tracking-[0.3px] text-zinc-500 uppercase">Möten bokat i veckan</p>
                <p className="text-[20px] leading-5 font-medium text-[#18181B]">{totalMeetingsThisWeek}</p>
                <p className="text-[10px] text-zinc-500">
                  <span className={meetingDelta >= 0 ? "text-[#1D9E75]" : "text-[#E24B4A]"}>
                    {meetingDelta >= 0 ? "+" : ""}
                    {meetingDelta} vs förra veckan
                  </span>
                </p>
              </div>
              <div className="w-1/4 px-3 py-2">
                <p className="text-[10px] tracking-[0.3px] text-zinc-500 uppercase">Rapporter att skicka</p>
                <p className="text-[20px] leading-5 font-medium text-[#EF9F27]">{reportsToSend}</p>
                <p className="text-[10px] text-zinc-500">Deadline: tisdag EOD</p>
              </div>
              <div className="w-1/4 px-3 py-2">
                <p className="text-[10px] tracking-[0.3px] text-zinc-500 uppercase">Snitt hälsopoäng</p>
                <p className="text-[20px] leading-5 font-medium text-[#18181B]">{averageHealth}</p>
                <p className="text-[10px] text-zinc-500">{redCampaigns} kampanjer i rött</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex-1 overflow-y-auto px-5 pb-3">
          <h2 className="mb-2 pt-0.5 text-[11px] font-medium tracking-[0.5px] text-zinc-500 uppercase">
            Aktiva kampanjer
          </h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {campaignCards.map(({ campaign, meetingsThisWeek }, index) => {
              const target = campaign.weekly_meeting_target;
              const progressPct = target > 0
                ? Math.min(100, Math.round((meetingsThisWeek / target) * 100))
                : 0;
              const healthLevel = getHealthLevel(campaign.health_score);
              const marketLabel = campaign.market.replaceAll("/", " · ");
              const reportDays = Math.max(1, reportDaysLeft) + (index % 2);

              return (
                <Link
                  key={campaign.campaign_id}
                  href={`/dashboard/${campaign.campaign_id}`}
                  className="block h-[160px] rounded-[8px] border border-zinc-200 bg-white p-2.5 transition hover:border-zinc-400"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] leading-4 font-bold text-[#18181B]">{campaign.client_name}</p>
                      <p className="text-[10px] text-zinc-500">{marketLabel}</p>
                    </div>
                  </div>

                  <div className="mb-2 flex items-center gap-1.5">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${healthDotClass(healthLevel)}`}
                      aria-label={`Hälsoindikator ${healthLevel}`}
                    />
                    {campaign.channels_enabled.map((channel) => {
                      const label = CHANNEL_LABELS[channel] ?? channel;
                      let channelClasses = "bg-zinc-100 text-zinc-700";

                      if (channel === "phone") {
                        channelClasses = "bg-[rgba(127,119,221,0.12)] text-[#534AB7]";
                      }
                      if (channel === "email") {
                        channelClasses = "bg-[rgba(29,158,117,0.12)] text-[#0F6E56]";
                      }
                      if (channel === "linkedin") {
                        channelClasses = "bg-[rgba(55,138,221,0.12)] text-[#185FA5]";
                      }

                      return (
                        <span
                          key={`${campaign.campaign_id}-${channel}`}
                          className={`rounded px-1.5 py-0.5 text-[9px] leading-3 font-medium ${channelClasses}`}
                        >
                          {label}
                        </span>
                      );
                    })}
                    <Badge className={`ml-auto ${statusClass(campaign.status)}`}>{STATUS_LABELS[campaign.status]}</Badge>
                  </div>

                  <div className="mb-1.5">
                    <p className="text-[11px] text-zinc-700">
                      Möten <span className="font-semibold">{meetingsThisWeek}/{target}</span>
                    </p>
                    <Progress value={progressPct} indicatorClassName={progressIndicatorClass(progressPct)} className="mt-0.5 h-[3px]" />
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-1 text-[10px]">
                    <p className="text-[10px] text-zinc-500">
                      Rapport om <span className="font-medium text-[#EF9F27]">{reportDays} dagar</span>
                    </p>
                    <p className="text-zinc-500">Hälsoindex {campaign.health_score}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
