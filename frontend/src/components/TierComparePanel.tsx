"use client";
import React from "react";
import type { TierComparisonRow } from "@/lib/types";

interface TierComparePanelProps {
  tierComparison?: TierComparisonRow[];
  selectedTier: number;
  minTierToAvoidSplitting: number;
  onSelectTier: (tier: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function TierComparePanel({
  tierComparison,
  selectedTier,
  minTierToAvoidSplitting,
  onSelectTier,
  isOpen,
  onClose,
}: TierComparePanelProps) {
  if (!isOpen || !tierComparison || tierComparison.length === 0) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[460px] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <div>
            <h2 className="font-bold text-sm text-white">Conveyor Tier Comparison</h2>
            <div className="text-[11px] text-slate-400">
              Logistics layout complexity across Conveyor Tiers Mk.1 – Mk.6
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
        >
          &times;
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
        <div className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center gap-2 text-sky-400 font-bold">
            <span>⭐ Recommended Tier:</span>
            <span>Mk.{minTierToAvoidSplitting}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-sans">
            Lowest conveyor tier capable of carrying all factory trunks in a single lane without splitting into parallel belts.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10.5px] uppercase tracking-wider text-slate-400">
                <th className="py-2 px-2.5">Tier</th>
                <th className="py-2 px-2">Cap</th>
                <th className="py-2 px-2 text-center">Lanes</th>
                <th className="py-2 px-2 text-center">Splitters</th>
                <th className="py-2 px-2 text-center">Mergers</th>
                <th className="py-2 px-2 text-right">Max Util</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tierComparison.map((row) => {
                const isSelected = row.tier === selectedTier;
                const isRecommended = row.tier === minTierToAvoidSplitting;

                return (
                  <tr
                    key={row.tier}
                    onClick={() => onSelectTier(row.tier)}
                    className={`cursor-pointer transition-colors hover:bg-slate-800/80 ${
                      isSelected
                        ? "bg-sky-950/40 font-semibold"
                        : isRecommended
                        ? "bg-emerald-950/20"
                        : ""
                    }`}
                  >
                    <td className="py-2.5 px-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-bold">{row.name}</span>
                        {isSelected && (
                          <span className="text-[9px] bg-sky-900 text-sky-300 px-1 py-0.2 rounded border border-sky-700">
                            Active
                          </span>
                        )}
                        {isRecommended && !isSelected && (
                          <span className="text-[9px] bg-emerald-900 text-emerald-300 px-1 py-0.2 rounded border border-emerald-700">
                            Rec
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-slate-300">
                      {row.capacity}/m
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={
                          row.lane_count > 1
                            ? "text-amber-400 font-bold"
                            : "text-emerald-400 font-medium"
                        }
                      >
                        {row.lane_count}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-300">
                      {row.splitter_count}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-300">
                      {row.merger_count}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span
                        className={
                          row.max_utilization_pct > 90
                            ? "text-emerald-400 font-bold"
                            : "text-slate-400"
                        }
                      >
                        {row.max_utilization_pct.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 text-center text-[11px] text-slate-500">
        Click any row to switch the factory's unlocked tier ceiling
      </div>
    </div>
  );
}
