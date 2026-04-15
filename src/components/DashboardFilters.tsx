"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useRef } from "react";

interface Props {
  markets: string[];
  activeFilter: string;
  activeSearch: string;
  activeMarket: string;
  activeHealth: string;
  counts: { alla: number; aktiva: number; atgard: number };
}

const HEALTH_OPTIONS = [
  { key: "",       label: "Alla" },
  { key: "green",  label: "● Grön" },
  { key: "yellow", label: "● Gul" },
  { key: "red",    label: "● Röd" },
];

export default function DashboardFilters({
  markets,
  activeFilter,
  activeSearch,
  activeMarket,
  activeHealth,
  counts,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(activeSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildUrl(overrides: {
    filter?: string;
    search?: string;
    market?: string;
    health?: string;
  }) {
    const params = new URLSearchParams();
    const f = overrides.filter  ?? activeFilter;
    const s = overrides.search  ?? search;
    const m = overrides.market  ?? activeMarket;
    const h = overrides.health  ?? activeHealth;
    if (f && f !== "alla") params.set("filter", f);
    if (s)                 params.set("search", s);
    if (m)                 params.set("market", m);
    if (h)                 params.set("health", h);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function handleSearch(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(buildUrl({ search: value }));
    }, 300);
  }

  function nav(overrides: Parameters<typeof buildUrl>[0]) {
    router.push(buildUrl(overrides));
  }

  const statusFilters = [
    { key: "alla",   label: "Alla",            count: counts.alla },
    { key: "aktiva", label: "Aktiva",           count: counts.aktiva },
    { key: "atgard", label: "⚠ Kräver åtgärd", count: counts.atgard },
  ] as const;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search input */}
      <div className="relative">
        <span className="pointer-events-none absolute left-[8px] top-1/2 -translate-y-1/2 text-zinc-400 text-[11px]">
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Sök klient…"
          className="rounded-[6px] border border-zinc-200 bg-[#F4F4F5] pl-[24px] pr-[8px] py-[5px] text-[11px] text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none w-[130px]"
        />
        {search && (
          <button
            onClick={() => handleSearch("")}
            className="absolute right-[6px] top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-[13px] leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Market filter */}
      <select
        value={activeMarket}
        onChange={(e) => nav({ market: e.target.value })}
        className="rounded-[6px] border border-zinc-200 bg-[#F4F4F5] px-[8px] py-[5px] text-[11px] text-zinc-600 focus:border-zinc-400 focus:outline-none"
      >
        <option value="">Alla marknader</option>
        {markets.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      {/* Health filter */}
      <div className="flex gap-[3px]">
        {HEALTH_OPTIONS.map(({ key, label }) => {
          const active = activeHealth === key;
          const colorCls = key === "green"
            ? active ? "border-[#1D9E75] bg-[rgba(29,158,117,0.1)] text-[#0F6E56]" : "text-[#1D9E75] border-zinc-200 bg-[#F4F4F5]"
            : key === "yellow"
            ? active ? "border-[#EF9F27] bg-[rgba(239,159,39,0.1)] text-[#A36B00]" : "text-[#EF9F27] border-zinc-200 bg-[#F4F4F5]"
            : key === "red"
            ? active ? "border-[#E24B4A] bg-[rgba(226,75,74,0.1)] text-[#A32D2D]" : "text-[#E24B4A] border-zinc-200 bg-[#F4F4F5]"
            : active ? "border-[#1D9E75] bg-[rgba(29,158,117,0.07)] text-[#1D9E75]" : "border-zinc-200 bg-[#F4F4F5] text-zinc-500";
          return (
            <button
              key={key}
              onClick={() => nav({ health: key })}
              className={`rounded-[6px] border px-[8px] py-[5px] text-[11px] leading-tight ${colorCls}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-[16px] w-px bg-zinc-200 mx-[2px]" />

      {/* Status filters */}
      {statusFilters.map(({ key, label, count }) => {
        const active = activeFilter === key;
        return (
          <button
            key={key}
            onClick={() => nav({ filter: key })}
            className={`rounded-[6px] px-[10px] py-[5px] text-[11px] border leading-tight ${
              active
                ? "border-[#1D9E75] bg-[rgba(29,158,117,0.07)] text-[#1D9E75]"
                : "border-zinc-200 bg-[#F4F4F5] text-zinc-500 hover:border-zinc-300"
            }`}
          >
            {label}
            {key !== "alla" && (
              <span className="ml-1 text-[10px] opacity-70">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
