import { CampaignStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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

function getStartOfWeek(date: Date): Date {
  const copy = new Date(date);
  const weekday = copy.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
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
    return "bg-emerald-600";
  }
  if (level === "yellow") {
    return "bg-amber-500";
  }
  return "bg-rose-500";
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
      return "bg-emerald-100 text-emerald-800";
    case "paused":
      return "bg-zinc-200 text-zinc-700";
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
  const today = new Date();
  const weekStart = getStartOfWeek(today);

  const campaigns = await prisma.campaign.findMany({
    include: {
      activity_logs: {
        where: {
          date: {
            gte: weekStart,
            lte: today,
          },
        },
        select: {
          meetings_booked: true,
        },
      },
    },
    orderBy: {
      client_name: "asc",
    },
  });

  return (
    <div className="flex min-h-screen bg-zinc-100 text-zinc-900">
      <aside className="hidden w-52 shrink-0 flex-col bg-zinc-900 md:flex">
        <div className="border-b border-white/10 px-4 py-5">
          <p className="text-base font-medium text-white">Otto</p>
          <p className="text-[10px] text-white/45">CoSeller Suite</p>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-3 text-sm">
          <div className="rounded-md bg-emerald-500/20 px-3 py-2 text-emerald-300">Dashboard</div>
          <div className="rounded-md px-3 py-2 text-white/60">Kampanjer</div>
          <div className="rounded-md px-3 py-2 text-white/60">Mina todos</div>
          <div className="rounded-md px-3 py-2 text-white/60">Rapporter</div>
        </nav>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
          <div>
            <h1 className="text-sm font-semibold">Kampanjoversikt</h1>
            <p className="text-xs text-zinc-500">Snabb blick over alla kampanjer</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-md px-2 py-1 text-xs">
              Alla
            </Badge>
            <Badge variant="secondary" className="rounded-md px-2 py-1 text-xs">
              Aktiva
            </Badge>
            <Badge variant="secondary" className="rounded-md px-2 py-1 text-xs">
              Kraver atgard
            </Badge>
          </div>
        </header>

        <section className="overflow-y-auto p-6">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Aktiva kampanjer
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => {
              const meetingsThisWeek = campaign.activity_logs.reduce(
                (sum, log) => sum + log.meetings_booked,
                0,
              );
              const target = campaign.weekly_meeting_target;
              const progressPct = target > 0 ? Math.min(100, Math.round((meetingsThisWeek / target) * 100)) : 0;
              const healthLevel = getHealthLevel(campaign.health_score);
              const marketLabel = campaign.market.replaceAll("/", " · ");

              return (
                <Card key={campaign.campaign_id} className="gap-3 rounded-lg border-zinc-200 py-4">
                  <CardHeader className="px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm">{campaign.client_name}</CardTitle>
                        <p className="mt-1 text-xs text-zinc-500">{marketLabel}</p>
                      </div>
                      <span
                        className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${healthDotClass(healthLevel)}`}
                        aria-label={`Halsoindikator ${healthLevel}`}
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 px-4">
                    <div className="rounded-md bg-zinc-100 p-3">
                      <p className="text-[11px] text-zinc-500">Moten denna vecka</p>
                      <p className="text-xl font-semibold">{meetingsThisWeek}</p>
                      <p className="text-[11px] text-zinc-500">mal: {target}</p>
                      <Progress value={progressPct} indicatorClassName={progressIndicatorClass(progressPct)} className="mt-2" />
                    </div>
                  </CardContent>

                  <CardFooter className="justify-between border-t border-zinc-100 px-4 pt-1">
                    <p className="text-xs text-zinc-500">Halsoindex: {campaign.health_score}</p>
                    <Badge className={statusClass(campaign.status)}>{STATUS_LABELS[campaign.status]}</Badge>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
