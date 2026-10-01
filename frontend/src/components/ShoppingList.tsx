"use client";
import React from "react";
import type { SolveResponse } from "@/lib/types";

export default function ShoppingList({ result }: { result: SolveResponse | null }) {
  if (!result) return null;

  // Compute logistics breakdown
  const beltSummary: Record<number, { single: number; parallelLines: number }> = {};
  result.connections.forEach(c => {
    if (!beltSummary[c.belt_tier]) {
      beltSummary[c.belt_tier] = { single: 0, parallelLines: 0 };
    }
    if (c.belt_count > 1) {
      beltSummary[c.belt_tier].parallelLines += c.belt_count;
    } else {
      beltSummary[c.belt_tier].single += 1;
    }
  });

  return (
    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Factory Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800 p-3 rounded border border-slate-600 flex flex-col items-center">
            <span className="text-2xl mb-1">🏭</span>
            <span className="text-xl font-bold text-white">{result.total_machines}</span>
            <span className="text-xs text-slate-400">Total Machines</span>
          </div>
          <div className="bg-slate-800 p-3 rounded border border-slate-600 flex flex-col items-center">
            <span className="text-2xl mb-1">⚡</span>
            <span className="text-xl font-bold text-sky-400">{result.total_power_mw.toFixed(1)}</span>
            <span className="text-xs text-slate-400">Power (MW)</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Target Outputs</h3>
        <div className="space-y-2">
          {Object.entries(result.target_outputs).map(([item, rate]) => (
            <div key={item} className="flex justify-between items-center bg-emerald-950/30 p-2 rounded border border-emerald-900">
              <span className="text-slate-300 capitalize text-sm">{item.replace(/_/g, ' ')}</span>
              <span className="text-emerald-400 font-mono text-sm">{rate.toFixed(1)}/m</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Resource Usage</h3>
        <div className="space-y-2">
          {Object.entries(result.resource_usage).map(([item, rate]) => (
            <div key={item} className="flex justify-between items-center bg-amber-950/30 p-2 rounded border border-amber-900">
              <span className="text-slate-300 capitalize text-sm">{item.replace(/_/g, ' ')}</span>
              <span className="text-amber-500 font-mono text-sm">{rate.toFixed(1)}/m</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Building Shopping List</h3>
        <div className="space-y-1">
          {Object.entries(result.shopping_list).map(([building, count]) => (
            <div key={building} className="flex justify-between items-center text-sm py-1 border-b border-slate-700/50 last:border-0">
              <span className="text-slate-400 capitalize">{building.replace(/_/g, ' ')}</span>
              <span className="text-white font-medium bg-slate-700 px-2 py-0.5 rounded">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Conveyor Logistics</h3>
        <div className="space-y-1.5">
          {Object.entries(beltSummary).map(([tier, stats]) => (
            <div key={tier} className="flex justify-between items-center text-xs bg-slate-800 p-2 rounded border border-slate-700">
              <span className="text-sky-400 font-semibold font-mono">Mk.{tier} Belts</span>
              <div className="text-slate-300 font-mono">
                {stats.single > 0 && <span>{stats.single} line{stats.single > 1 ? 's' : ''}</span>}
                {stats.parallelLines > 0 && (
                  <span className="text-amber-400 ml-1">({stats.parallelLines} parallel)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
