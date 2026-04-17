import Link from "next/link";
import { CampaignStatus, ChecklistType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

const STATUS_LABELS: Record<CampaignStatus, string> = {
  onboarding: "Onboarding",
  active: "Aktiv",
  paused: "Pausad",
  closing: "Avslutar",
  closed: "Avslutad",
};

const STATUS_CLS: Record<CampaignStatus, string> = {
  active: "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]",
  paused: "bg-zinc-100 text-zinc-500",
  onboarding: "bg-sky-100 text-sky-700",
  closing: "bg-amber-100 text-amber-700",
  closed: "bg-zinc-100 text-zinc-400",
};

function healthDotCls(score: number): string {
  if (score > 74) return "bg-[#1D9E75]";
  if (score > 39) return "bg-[#EF9F27]";
  return "bg-[#E24B4A]";
}

function progressBarFillCls(pct: number): string {
  if (pct < 40) return "bg-[#E24B4A]";
  if (pct < 75) return "bg-[#EF9F27]";
  return "bg-[#1D9E75]";
}

type ChecklistItemJson = {
  order: number;
  title: string;
  is_blocking?: boolean;
  completed?: boolean;
};

type InstanceRow = {
  instance_id: string;
  created_at: Date;
  completion_pct: number;
  week_number: number | null;
  year: number | null;
  items: unknown;
  template: { type: ChecklistType; name: string; items: unknown };
  campaign: {
    campaign_id: string;
    client_name: string;
    status: CampaignStatus;
    health_score: number;
  };
};

function parseItems(raw: unknown): ChecklistItemJson[] {
  if (!Array.isArray(raw)) return [];
  return raw as ChecklistItemJson[];
}

function itemStats(items: ChecklistItemJson[]): { done: number; total: number; blocking: number } {
  const total = items.length;
  const done = items.filter((i) => i.completed).length;
  const blocking = items.filter((i) => i.is_blocking === true && i.completed !== true).length;
  return { done, total, blocking };
}

function typeBadge(type: ChecklistType): { label: string; cls: string } {
  if (type === "startup") return { label: "Uppstart", cls: "bg-[rgba(55,138,221,0.1)] text-[#185FA5]" };
  if (type === "weekly") return { label: "Veckovis", cls: "bg-[rgba(29,158,117,0.1)] text-[#0F6E56]" };
  return { label: "Avslut", cls: "bg-[rgba(239,159,39,0.1)] text-[#854F0B]" };
}

function pickWeeklyForOverview(
  weeklyAll: InstanceRow[],
  currentWeek: number,
  currentYear: number
): InstanceRow[] {
  const byCampaign = new Map<string, InstanceRow[]>();
  for (const inst of weeklyAll) {
    const id = inst.campaign.campaign_id;
    const arr = byCampaign.get(id) ?? [];
    arr.push(inst);
    byCampaign.set(id, arr);
  }
  const picked: InstanceRow[] = [];
  for (const [, list] of byCampaign) {
    const current = list.find((i) => i.week_number === currentWeek && i.year === currentYear);
    if (current) {
      picked.push(current);
      continue;
    }
    const sorted = list.slice().sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    const latest = sorted[0];
    if (latest) picked.push(latest);
  }
  return picked.sort((a, b) => a.campaign.client_name.localeCompare(b.campaign.client_name));
}

function StartupClosedownTable({ rows, emptyMessage }: { rows: InstanceRow[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return (
      <div className="px-3 py-[12px] text-center text-[12px] text-[#71717A]">{emptyMessage}</div>
    );
  }
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
          {["Kampanj", "Status", "Slutfört", "Blockerande", "Progress", "Åtgärd"].map((h) => (
            <th
              key={h}
              className="px-3 py-[7px] text-left text-[9px] font-medium uppercase tracking-[0.4px] text-[#71717A]"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((inst, idx) => {
          const items = parseItems(inst.items);
          const { done, total, blocking } = itemStats(items);
          const pct = inst.completion_pct;
          const isLast = idx === rows.length - 1;
          const st = inst.campaign.status;
          return (
            <tr key={inst.instance_id} className={isLast ? "" : "border-b border-[#F4F4F5]"}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${healthDotCls(inst.campaign.health_score)}`} />
                  <Link
                    href={`/dashboard/${inst.campaign.campaign_id}?tab=checklistor`}
                    className="text-[12px] font-medium text-[#18181B] hover:underline"
                  >
                    {inst.campaign.client_name}
                  </Link>
                </div>
              </td>
              <td className="px-3 py-2">
                <span className={`rounded-[10px] px-[7px] py-[2px] text-[10px] font-medium ${STATUS_CLS[st]}`}>
                  {STATUS_LABELS[st]}
                </span>
              </td>
              <td className="px-3 py-2 text-[11px] text-[#71717A]">
                {done}/{total} items
              </td>
              <td className="px-3 py-2">
                {blocking === 0 ? (
                  <span className="text-[11px] text-[#71717A]">–</span>
                ) : (
                  <span className="text-[11px] font-medium text-[#A32D2D]">
                    {blocking} 🔒
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center">
                  <div className="h-[5px] w-[80px] rounded-[3px] bg-[#E4E4E7]">
                    <div
                      className={`h-full rounded-[3px] ${progressBarFillCls(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="ml-[6px] text-[10px] text-[#71717A] tabular-nums">{pct}%</span>
                </div>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/dashboard/${inst.campaign.campaign_id}?tab=checklistor`}
                  className="inline-block rounded-[5px] border border-[#E4E4E7] bg-white px-2 py-[3px] text-[10px] text-[#71717A] hover:bg-[#FAFAFA]"
                >
                  Öppna →
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function WeeklyTable({ rows }: { rows: InstanceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-3 py-[12px] text-center text-[12px] text-[#71717A]">Inga veckochecklistor att visa.</div>
    );
  }
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
          {["Kampanj", "Status", "Slutfört", "Vecka", "Progress", "Åtgärd"].map((h) => (
            <th
              key={h}
              className="px-3 py-[7px] text-left text-[9px] font-medium uppercase tracking-[0.4px] text-[#71717A]"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((inst, idx) => {
          const items = parseItems(inst.items);
          const { done, total } = itemStats(items);
          const pct = inst.completion_pct;
          const isLast = idx === rows.length - 1;
          const st = inst.campaign.status;
          const wk = inst.week_number ?? "–";
          return (
            <tr key={inst.instance_id} className={isLast ? "" : "border-b border-[#F4F4F5]"}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${healthDotCls(inst.campaign.health_score)}`} />
                  <Link
                    href={`/dashboard/${inst.campaign.campaign_id}?tab=checklistor`}
                    className="text-[12px] font-medium text-[#18181B] hover:underline"
                  >
                    {inst.campaign.client_name}
                  </Link>
                </div>
              </td>
              <td className="px-3 py-2">
                <span className={`rounded-[10px] px-[7px] py-[2px] text-[10px] font-medium ${STATUS_CLS[st]}`}>
                  {STATUS_LABELS[st]}
                </span>
              </td>
              <td className="px-3 py-2 text-[11px] text-[#71717A]">
                {done}/{total} items
              </td>
              <td className="px-3 py-2 text-[11px] text-[#71717A]">{typeof wk === "number" ? `v.${wk}` : wk}</td>
              <td className="px-3 py-2">
                <div className="flex items-center">
                  <div className="h-[5px] w-[80px] rounded-[3px] bg-[#E4E4E7]">
                    <div
                      className={`h-full rounded-[3px] ${progressBarFillCls(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="ml-[6px] text-[10px] text-[#71717A] tabular-nums">{pct}%</span>
                </div>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/dashboard/${inst.campaign.campaign_id}?tab=checklistor`}
                  className="inline-block rounded-[5px] border border-[#E4E4E7] bg-white px-2 py-[3px] text-[10px] text-[#71717A] hover:bg-[#FAFAFA]"
                >
                  Öppna →
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default async function ChecklistorPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentWeek = isoWeek(today);
  const currentYear = today.getFullYear();

  const [pm, instances, templates] = await Promise.all([
    prisma.user.findFirst({ where: { role: "pm" }, select: { name: true, avatar_initials: true } }),
    prisma.checklistInstance.findMany({
      include: {
        template: { select: { type: true, name: true, items: true } },
        campaign: { select: { campaign_id: true, client_name: true, status: true, health_score: true } },
      },
      orderBy: { created_at: "desc" },
    }),
    prisma.checklistTemplate.findMany({
      select: { template_id: true, type: true, name: true, version: true, items: true },
      orderBy: { type: "asc" },
    }),
  ]);

  const instRows = instances as unknown as InstanceRow[];

  const startup = instRows.filter((i) => i.template.type === "startup");
  const weeklyAll = instRows.filter((i) => i.template.type === "weekly");
  const closedown = instRows.filter((i) => i.template.type === "closedown");

  const weeklyShown = pickWeeklyForOverview(weeklyAll, currentWeek, currentYear);

  const totalInstances = instRows.length;
  const completed = instRows.filter((i) => i.completion_pct === 100).length;
  const blocking = instRows.filter((i) => i.completion_pct < 100 && i.campaign.status === "onboarding").length;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F4F5] text-zinc-900" style={{ fontSize: 13 }}>
      <aside className="flex w-[200px] min-w-[200px] shrink-0 flex-col bg-[#18181B]">
        <div className="border-b border-white/[0.07] px-4 py-3">
          <p className="text-[11px] font-medium leading-tight text-white">Project Management -</p>
          <p className="mt-[1px] text-[10px] leading-tight text-white/35">Outbound</p>
        </div>
        <nav className="flex-1 space-y-[2px] px-2 py-3">
          {[
            { label: "▦ Dashboard", href: "/dashboard", active: false },
            { label: "◈ Kampanjer", href: "/dashboard", active: false },
            { label: "✓ Mina todos", href: "/todos", active: false },
            { label: "↗ Rapporter", href: "/rapporter", active: false },
            { label: "≡ Checklistor", href: "/checklistor", active: true },
            { label: "⚙ ICP-bibliotek", href: "/icp", active: false },
          ].map(({ label, href, active }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-2 rounded-[6px] px-[10px] py-2 text-[12px] leading-tight ${
                active ? "bg-white/[0.07] text-white" : "text-white/45 hover:text-white/70"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-white/[0.07] px-[14px] py-3">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-[10px] font-medium text-white">
            {pm?.avatar_initials ?? "PM"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] leading-tight text-white/60">{pm?.name ?? "Project Manager"}</p>
            <p className="mt-[1px] text-[10px] leading-tight text-white/30">Project Manager</p>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-[#E4E4E7] bg-white px-[18px] py-[13px]">
          <div>
            <p className="text-[15px] font-medium text-[#18181B]">Checklistor</p>
            <p className="text-[11px] text-[#71717A]">
              {completed}/{totalInstances} slutförda · {blocking} blockerande
            </p>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-3 gap-[10px]">
            <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[10px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Uppstartschecklistor</p>
              <p className="mt-1 text-[20px] font-medium text-[#18181B]">{startup.length}</p>
              <p className="mt-[3px] text-[10px] text-[#71717A]">
                {startup.filter((i) => i.completion_pct === 100).length} slutförda
              </p>
            </div>
            <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[10px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Veckochecklistor</p>
              <p className="mt-1 text-[20px] font-medium text-[#18181B]">{weeklyAll.length}</p>
              <p className="mt-[3px] text-[10px] text-[#71717A]">Skapas automatiskt varje måndag</p>
            </div>
            <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[10px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Avslutschecklistor</p>
              <p className="mt-1 text-[20px] font-medium text-[#18181B]">{closedown.length}</p>
              <p className="mt-[3px] text-[10px] text-[#71717A]">
                {closedown.filter((i) => i.completion_pct < 100).length} ej klara
              </p>
            </div>
          </div>

          <div>
            <p className="mb-[8px] text-[10px] font-medium uppercase tracking-[0.5px] text-[#71717A]">
              UPPSTARTSCHECKLISTOR
            </p>
            <div className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
              <StartupClosedownTable rows={startup} emptyMessage="Inga uppstartschecklistor aktiva." />
            </div>
          </div>

          <div>
            <p className="mb-[8px] text-[10px] font-medium uppercase tracking-[0.5px] text-[#71717A]">
              VECKOCHECKLISTOR · v.{currentWeek}
            </p>
            <div className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
              <WeeklyTable rows={weeklyShown} />
            </div>
          </div>

          <div>
            <p className="mb-[8px] text-[10px] font-medium uppercase tracking-[0.5px] text-[#71717A]">
              AVSLUTSCHECKLISTOR
            </p>
            <div className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
              <StartupClosedownTable rows={closedown} emptyMessage="Inga avslutschecklistor aktiva." />
            </div>
          </div>

          <div>
            <p className="mb-[8px] text-[10px] font-medium uppercase tracking-[0.5px] text-[#71717A]">
              MALLAR I SYSTEMET
            </p>
            <div className="grid grid-cols-3 gap-[10px]">
              {templates.map((tpl) => {
                const badge = typeBadge(tpl.type);
                const tplItems = parseItems(tpl.items);
                return (
                  <div key={tpl.template_id} className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[10px]">
                    <span className={`inline-block rounded-[10px] px-[7px] py-[2px] text-[10px] font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <p className="mt-[6px] text-[13px] font-medium text-[#18181B]">{tpl.name}</p>
                    <p className="mt-[4px] text-[11px] text-[#71717A]">{tplItems.length} items</p>
                    <p className="mt-[2px] text-[10px] text-[#A1A1AA]">v{tpl.version}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
