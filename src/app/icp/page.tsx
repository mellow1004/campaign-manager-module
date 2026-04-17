import Link from "next/link";
import { CampaignStatus, IcpStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

function versionChipCls(status: IcpStatus): string {
  if (status === "active") {
    return "border border-[#1D9E75] bg-[rgba(29,158,117,0.15)] text-[#0F6E56]";
  }
  if (status === "approved") {
    return "border border-amber-300 bg-amber-50 text-amber-700";
  }
  return "border border-[#E4E4E7] bg-[#F4F4F5] text-[#71717A]";
}

function fmtPool(n: number): string {
  return new Intl.NumberFormat("sv-SE").format(n);
}

type IcpRow = {
  icp_id: string;
  campaign_id: string;
  version: number;
  status: IcpStatus;
  industry_verticals: string[];
  job_titles: string[];
  geographies: string[];
  exclusion_domains: string[];
  current_focus: string;
  estimated_pool_size: number;
  campaign: {
    campaign_id: string;
    client_name: string;
    market: string;
    status: CampaignStatus;
    health_score: number;
  };
};

export default async function IcpLibraryPage() {
  const [pm, icps] = await Promise.all([
    prisma.user.findFirst({ where: { role: "pm" }, select: { name: true, avatar_initials: true } }),
    prisma.iCP.findMany({
      include: {
        campaign: {
          select: {
            campaign_id: true,
            client_name: true,
            market: true,
            status: true,
            health_score: true,
          },
        },
      },
      orderBy: [{ campaign: { client_name: "asc" } }, { version: "desc" }],
    }),
  ]);

  const rows = icps as unknown as IcpRow[];

  const campaignMap = new Map<string, IcpRow[]>();
  for (const icp of rows) {
    const key = icp.campaign_id;
    if (!campaignMap.has(key)) campaignMap.set(key, []);
    campaignMap.get(key)!.push(icp);
  }
  const campaignIcps = Array.from(campaignMap.values()).sort((a, b) => {
    const an = a[0]?.campaign.client_name ?? "";
    const bn = b[0]?.campaign.client_name ?? "";
    return an.localeCompare(bn);
  });

  const totalCampaigns = campaignIcps.length;
  const activeIcps = rows.filter((i) => i.status === "active").length;
  const draftIcps = rows.filter((i) => i.status === "draft").length;
  const totalVersions = rows.length;

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
            { label: "≡ Checklistor", href: "/checklistor", active: false },
            { label: "⚙ ICP-bibliotek", href: "/icp", active: true },
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
            <p className="text-[15px] font-medium text-[#18181B]">ICP-bibliotek</p>
            <p className="text-[11px] text-[#71717A]">
              {totalCampaigns} kampanjer · {totalVersions} profiler totalt · {activeIcps} aktiva
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-[14px] grid grid-cols-4 gap-[10px]">
            <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[10px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Aktiva profiler</p>
              <p className="mt-1 text-[20px] font-medium text-[#1D9E75]">{activeIcps}</p>
            </div>
            <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[10px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Utkast</p>
              <p className="mt-1 text-[20px] font-medium text-[#EF9F27]">{draftIcps}</p>
            </div>
            <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[10px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Kampanjer med ICP</p>
              <p className="mt-1 text-[20px] font-medium text-[#18181B]">{totalCampaigns}</p>
            </div>
            <div className="rounded-[8px] border border-[#E4E4E7] bg-white px-[14px] py-[10px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Versioner totalt</p>
              <p className="mt-1 text-[20px] font-medium text-[#18181B]">{totalVersions}</p>
            </div>
          </div>

          {campaignIcps.length === 0 ? (
            <p className="py-[24px] text-center text-[12px] text-[#71717A]">Inga ICP-profiler skapade ännu.</p>
          ) : (
            <div className="grid grid-cols-2 gap-[12px]">
              {campaignIcps.map((versions) => {
                const activeIcp = versions.find((v) => v.status === "active") ?? versions[0];
                if (!activeIcp) return null;
                const c = activeIcp.campaign;
                const shownTitles = activeIcp.job_titles.slice(0, 3);
                const extraTitles = Math.max(0, activeIcp.job_titles.length - 3);

                return (
                  <div key={c.campaign_id} className="overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white">
                    <div className="flex items-start justify-between border-b border-[#F4F4F5] bg-[#FAFAFA] px-[14px] py-[10px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${healthDotCls(c.health_score)}`} />
                          <p className="truncate text-[13px] font-medium text-[#18181B]">{c.client_name}</p>
                          <span className={`shrink-0 rounded-[10px] px-[7px] py-[2px] text-[10px] font-medium ${STATUS_CLS[c.status]}`}>
                            {STATUS_LABELS[c.status]}
                          </span>
                        </div>
                        <p className="mt-[4px] text-[11px] text-[#71717A]">{c.market}</p>
                        <div className="mt-[6px] flex flex-wrap">
                          {versions
                            .slice()
                            .sort((a, b) => b.version - a.version)
                            .map((v) => (
                              <span
                                key={v.icp_id}
                                className={`mr-[3px] rounded-[3px] px-[5px] py-[1px] text-[9px] font-medium ${versionChipCls(v.status)}`}
                              >
                                v{v.version}
                              </span>
                            ))}
                        </div>
                      </div>
                      <Link href={`/dashboard/${c.campaign_id}?tab=icp`} className="shrink-0 text-[11px] text-[#185FA5] hover:underline">
                        Öppna →
                      </Link>
                    </div>

                    <div className="px-[14px] py-3">
                      <div>
                        <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Branscher</p>
                        {activeIcp.industry_verticals.length === 0 ? (
                          <span className="text-[11px] text-[#71717A]">–</span>
                        ) : (
                          <div className="flex flex-wrap">
                            {activeIcp.industry_verticals.map((t) => (
                              <span
                                key={t}
                                className="mb-[3px] mr-[3px] rounded-[3px] bg-[#F4F4F5] px-[6px] py-[1px] text-[10px] text-[#18181B]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-[10px] grid grid-cols-2 gap-x-[12px] gap-y-[10px]">
                        <div>
                          <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Jobbtitlar</p>
                          {shownTitles.length === 0 ? (
                            <span className="text-[11px] text-[#71717A]">–</span>
                          ) : (
                            <div className="flex flex-wrap items-center">
                              {shownTitles.map((t) => (
                                <span
                                  key={t}
                                  className="mb-[3px] mr-[3px] rounded-[3px] bg-[#F4F4F5] px-[6px] py-[1px] text-[10px] text-[#18181B]"
                                >
                                  {t}
                                </span>
                              ))}
                              {extraTitles > 0 && (
                                <span className="mb-[3px] text-[10px] text-[#71717A]">+{extraTitles} fler</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Geografi</p>
                          {activeIcp.geographies.length === 0 ? (
                            <span className="text-[11px] text-[#71717A]">–</span>
                          ) : (
                            <div className="flex flex-wrap">
                              {activeIcp.geographies.map((g) => (
                                <span
                                  key={g}
                                  className="mb-[3px] mr-[3px] rounded-[3px] bg-[#F4F4F5] px-[6px] py-[1px] text-[10px] text-[#18181B]"
                                >
                                  {g}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Audience pool</p>
                          <p className="text-[14px] font-medium text-[#18181B]">{fmtPool(activeIcp.estimated_pool_size)}</p>
                        </div>
                        <div>
                          <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Fokus denna vecka</p>
                          <p className="text-[11px] text-[#18181B]">{activeIcp.current_focus.trim() ? activeIcp.current_focus : "–"}</p>
                        </div>
                      </div>
                    </div>

                    {activeIcp.exclusion_domains.length > 0 && (
                      <div className="border-t border-[#F4F4F5] bg-[#FAFAFA] px-[14px] py-2">
                        <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.4px] text-[#71717A]">Uteslutna domäner</p>
                        <div className="flex flex-wrap">
                          {activeIcp.exclusion_domains.map((d) => (
                            <span
                              key={d}
                              className="mb-[3px] mr-[3px] rounded-[3px] bg-rose-50 px-[5px] py-[1px] text-[10px] text-rose-700"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
