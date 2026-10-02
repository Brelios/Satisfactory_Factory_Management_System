"use client";
import React from "react";
import type { SolveResponse } from "@/lib/types";
import { getItemColor, formatItemName } from "@/lib/colors";

export default function ShoppingList({ result }: { result: SolveResponse | null }) {
  if (!result) return null;

  // Compute logistics breakdown & parallel belt warnings
  const beltSummary: Record<number, { single: number; parallelLines: number; maxFlow: number }> = {};
  const parallelBeltAlerts: { item: string; rate: number; tier: number; count: number; cap: number }[] = [];

  const BELT_CAPS: Record<number, number> = {
    1: 60,
    2: 120,
    3: 270,
    4: 480,
    5: 780,
    6: 1200,
  };

  result.connections.forEach((c) => {
    if (!beltSummary[c.belt_tier]) {
      beltSummary[c.belt_tier] = { single: 0, parallelLines: 0, maxFlow: 0 };
    }
    beltSummary[c.belt_tier].maxFlow = Math.max(beltSummary[c.belt_tier].maxFlow, c.rate);

    if (c.belt_count > 1) {
      beltSummary[c.belt_tier].parallelLines += c.belt_count;
      parallelBeltAlerts.push({
        item: c.item,
        rate: c.rate,
        tier: c.belt_tier,
        count: c.belt_count,
        cap: BELT_CAPS[c.belt_tier] || 60,
      });
    } else {
      beltSummary[c.belt_tier].single += 1;
    }
  });

  // Identify primary bottleneck
  const mostConsumed = Object.entries(result.resource_usage).sort((a, b) => b[1] - a[1])[0];
  const maxFlowConn = [...result.connections].sort((a, b) => b.rate - a.rate)[0];

  return (
    <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700/80 space-y-5 select-none shadow-xl">
      {/* 1. High-Level Metrics */}
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
          <span>📊 Factory Summary</span>
          <span className="text-[10px] text-sky-400 font-mono font-normal">Deterministic LP</span>
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col items-center text-center">
            <span className="text-xl mb-0.5">🏭</span>
            <span className="text-xl font-bold font-mono text-white">{result.total_machines}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Total Machines</span>
          </div>
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col items-center text-center">
            <span className="text-xl mb-0.5">⚡</span>
            <span className="text-xl font-bold font-mono text-amber-400">
              {result.total_power_mw.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Power (MW)</span>
          </div>
        </div>
      </div>

      {/* 2. Bottleneck & Efficiency Insights */}
      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          🔍 Bottleneck &amp; Efficiency
        </div>
        {mostConsumed && (
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className="text-slate-400">Limiting Ore:</span>
            <span className="text-slate-200 font-bold">
              {formatItemName(mostConsumed[0])} ({mostConsumed[1].toFixed(1)}/m)
            </span>
          </div>
        )}
        {maxFlowConn && (
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className="text-slate-400">Peak Conveyor:</span>
            <span className="text-sky-400 font-bold">
              {formatItemName(maxFlowConn.item)} ({maxFlowConn.rate.toFixed(1)}/m)
            </span>
          </div>
        )}
      </div>

      {/* 3. Target Outputs */}
      <div>
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          🎯 Target Outputs
        </h4>
        <div className="space-y-1.5">
          {Object.entries(result.target_outputs).map(([item, rate]) => (
            <div
              key={item}
              className="flex justify-between items-center bg-emerald-950/30 px-3 py-2 rounded-lg border border-emerald-900/60"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: getItemColor(item) }}
                />
                <span className="text-slate-200 font-medium text-xs">
                  {formatItemName(item)}
                </span>
              </div>
              <span className="text-emerald-400 font-mono font-bold text-xs">
                {rate.toFixed(1)}/m
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Raw Inputs Consumed */}
      <div>
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          ⛏️ Raw Ore Extraction
        </h4>
        <div className="space-y-1.5">
          {Object.entries(result.resource_usage).map(([item, rate]) => (
            <div
              key={item}
              className="flex justify-between items-center bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: getItemColor(item) }}
                />
                <span className="text-slate-300 font-medium text-xs">
                  {formatItemName(item)}
                </span>
              </div>
              <span className="font-mono font-bold text-xs" style={{ color: getItemColor(item) }}>
                {rate.toFixed(1)}/m
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Building Shopping List */}
      <div>
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          🏗️ Building Shopping List
        </h4>
        <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
          {Object.entries(result.shopping_list).map(([building, count]) => (
            <div
              key={building}
              className="flex justify-between items-center text-xs py-1 border-b border-slate-800/80 last:border-0"
            >
              <span className="text-slate-300 capitalize">
                {building.replace(/_/g, " ")}
              </span>
              <span className="text-white font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Physical Logistics Infrastructure */}
      {result.logistics && (
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
          <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center justify-between">
            <span>⚙️ Physical Logistics</span>
            <span className="text-[10px] text-slate-400 font-mono">Mk.{result.logistics.selected_tier} Cap</span>
          </h4>
          <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <div className="text-white font-bold text-sm">{result.logistics.total_lanes}</div>
              <div className="text-[9px] text-slate-400 uppercase">Lanes</div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <div className="text-white font-bold text-sm">{result.logistics.total_splitters}</div>
              <div className="text-[9px] text-slate-400 uppercase">Splitters</div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <div className="text-white font-bold text-sm">{result.logistics.total_mergers}</div>
              <div className="text-[9px] text-slate-400 uppercase">Mergers</div>
            </div>
          </div>
          {result.logistics.power_shards_total > 0 && (
            <div className="flex justify-between items-center bg-amber-950/40 border border-amber-800/60 px-2.5 py-1.5 rounded-lg text-xs font-mono text-amber-300">
              <span className="flex items-center gap-1.5">
                <span>💎</span>
                <span>Power Shards:</span>
              </span>
              <span className="font-bold text-white bg-amber-600 px-2 py-0.5 rounded text-[11px]">
                {result.logistics.power_shards_total}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 7. Conveyor Logistics & Parallel Belt Feedback */}
      <div>
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          🛤️ Conveyor Logistics &amp; Tiers
        </h4>
        <div className="space-y-2">
          {Object.entries(beltSummary).map(([tier, stats]) => (
            <div
              key={tier}
              className="flex justify-between items-center text-xs bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800"
            >
              <span className="text-sky-400 font-bold font-mono">
                Mk.{tier} ({BELT_CAPS[Number(tier)] || 60}/m cap)
              </span>
              <div className="text-slate-300 font-mono text-[11px]">
                {stats.single > 0 && <span>{stats.single} belt{stats.single > 1 ? "s" : ""}</span>}
                {stats.parallelLines > 0 && (
                  <span className="text-amber-400 font-semibold ml-1.5">
                    ({stats.parallelLines} parallel lines)
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Parallel Belt Feedback Alert */}
          {parallelBeltAlerts.map((alert, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-200 font-mono space-y-0.5"
            >
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <span>⚠️</span>
                <span>Parallel Belt Required</span>
              </div>
              <div className="text-slate-300">
                {formatItemName(alert.item)}: {alert.rate.toFixed(0)}/m flow exceeds Mk.{alert.tier} cap ({alert.cap}/m).
              </div>
              <div className="text-amber-400 font-bold">
                → Split into {alert.count}&times; parallel Mk.{alert.tier} lines.
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
