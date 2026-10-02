"use client";
import React, { useState, useMemo } from "react";
import type { CompareVariant } from "@/lib/types";
import {
  formatItemName,
  getItemColor,
  calculateResourceScore,
} from "@/lib/colors";

interface ComparePanelProps {
  variants: CompareVariant[] | null;
  isLoading: boolean;
  onSelectVariant: (variant: CompareVariant) => void;
  selectedLabel: string | null;
  bestMachines: string;
  bestPower: string;
}

export default function ComparePanel({
  variants,
  isLoading,
  onSelectVariant,
  selectedLabel,
  bestMachines,
  bestPower,
}: ComparePanelProps) {
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Compute resource comparisons across all variants
  const comparisonAnalytics = useMemo(() => {
    if (!variants || variants.length === 0) return null;

    // 1. Calculate weighted scores
    const variantScores = variants.map((v) => ({
      label: v.label,
      score: calculateResourceScore(v.resource_usage || {}),
    }));

    const minScore = Math.min(...variantScores.map((s) => s.score));

    // 2. Identify all resources consumed
    const allResources = new Set<string>();
    variants.forEach((v) => {
      Object.keys(v.resource_usage || {}).forEach((r) => allResources.add(r));
    });

    // 3. Find lowest consumer for each specific resource
    // Only if there is variation (min < max)
    const perResourceMins: Record<string, { minVal: number; bestLabels: Set<string> }> = {};

    allResources.forEach((res) => {
      const usages = variants.map((v) => (v.resource_usage ? v.resource_usage[res] || 0 : 0));
      const minVal = Math.min(...usages);
      const maxVal = Math.max(...usages);

      if (maxVal - minVal > 0.05) {
        const bestLabels = new Set(
          variants
            .filter((v) => {
              const u = v.resource_usage ? v.resource_usage[res] || 0 : 0;
              return Math.abs(u - minVal) < 0.05;
            })
            .map((v) => v.label)
        );
        perResourceMins[res] = { minVal, bestLabels };
      }
    });

    // Find best output rate
    const bestOutput = variants.reduce((max, v) => {
      const totalOut = Object.values(v.target_outputs || {}).reduce((s, r) => s + r, 0);
      return Math.max(max, totalOut);
    }, 0);

    return {
      variantScores: Object.fromEntries(variantScores.map((s) => [s.label, s.score])),
      minScore,
      perResourceMins,
      bestOutput,
    };
  }, [variants]);

  if (isLoading) {
    return (
      <div className="w-full h-24 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-center">
        <div className="animate-pulse text-sky-400 text-sm font-medium">
          ⚙️ Calculating all alternative recipe combinations...
        </div>
      </div>
    );
  }

  if (!variants || variants.length === 0 || !comparisonAnalytics) return null;

  const { variantScores, minScore, perResourceMins, bestOutput } = comparisonAnalytics;

  return (
    <div className="w-full bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-3 shrink-0 shadow-xl select-none">
      {/* Header with View Toggle */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-base">⚖️</span>
          <h3 className="text-sm font-bold text-white tracking-wide">
            Recipe Variation Comparison ({variants.length} plans)
          </h3>
        </div>

        <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setViewMode("cards")}
            className={`px-3 py-1 rounded transition-colors ${
              viewMode === "cards"
                ? "bg-sky-600 text-white font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Cards View
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1 rounded transition-colors ${
              viewMode === "table"
                ? "bg-sky-600 text-white font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Table View
          </button>
        </div>
      </div>

      {/* 1. Cards Carousel View */}
      {viewMode === "cards" && (
        <div className="w-full overflow-x-auto pb-1.5">
          <div className="flex gap-3 w-max">
            {variants.map((variant) => {
              const isSelected = variant.label === selectedLabel;
              const isBestMachine = variant.label === bestMachines;
              const isBestPower = variant.label === bestPower;
              const vScore = variantScores[variant.label] ?? 0;
              const isBestOverallResources = Math.abs(vScore - minScore) < 0.05 && vScore > 0;

              // Check which specific resources this variant is lowest in
              const lowestResBadges: string[] = [];
              Object.entries(perResourceMins).forEach(([res, info]) => {
                if (info.bestLabels.has(variant.label)) {
                  const cleanName = formatItemName(res).replace(/ Ore/i, "");
                  lowestResBadges.push(cleanName);
                }
              });

              const outputs = Object.entries(variant.target_outputs || {});
              const resourcesUsed = Object.entries(variant.resource_usage || {});

              return (
                <div
                  key={variant.label}
                  onClick={() => onSelectVariant(variant)}
                  className={`w-72 p-3.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-slate-900 border-2 border-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.35)]"
                      : "bg-slate-900/90 border border-slate-700/80 hover:border-slate-500"
                  }`}
                >
                  <div
                    className="font-bold text-white text-xs mb-2 leading-tight truncate"
                    title={variant.label}
                  >
                    {variant.label}
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs font-mono">
                    {/* Target Output */}
                    {outputs.length > 0 && (
                      <div className="flex justify-between items-center bg-slate-950/70 px-2 py-1 rounded border border-slate-800 text-[11px]">
                        <span className="text-slate-400">Target Output:</span>
                        <span className="font-bold text-emerald-400">
                          {outputs[0][1].toFixed(1)}/m {formatItemName(outputs[0][0])}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-sans">Machines:</span>
                      <span className={`font-bold ${isBestMachine ? "text-emerald-400" : "text-slate-200"}`}>
                        {variant.total_machines}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-sans">Power:</span>
                      <span className={`font-bold ${isBestPower ? "text-emerald-400" : "text-slate-200"}`}>
                        {variant.total_power_mw.toFixed(1)} MW
                      </span>
                    </div>

                    {/* Raw Resources Consumed */}
                    <div className="border-t border-slate-800/80 pt-1 space-y-0.5">
                      <div className="text-[10px] text-slate-400 font-sans flex justify-between">
                        <span>Resource Value Score:</span>
                        <span className={`font-mono font-bold ${isBestOverallResources ? "text-purple-400" : "text-slate-300"}`}>
                          {vScore.toFixed(0)} pts
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {resourcesUsed.map(([r, rate]) => (
                          <span
                            key={r}
                            className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full inline-block mr-1"
                              style={{ backgroundColor: getItemColor(r) }}
                            />
                            {rate.toFixed(0)}/m {formatItemName(r).replace(/ Ore/i, "")}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Comparison Badges */}
                    <div className="mt-1 pt-1.5 border-t border-slate-800 flex flex-wrap gap-1 font-sans">
                      {isBestMachine && (
                        <span className="bg-emerald-950/70 text-emerald-400 text-[9.5px] font-semibold px-2 py-0.5 rounded border border-emerald-800">
                          🏆 Fewest Machines
                        </span>
                      )}
                      {isBestPower && (
                        <span className="bg-sky-950/70 text-sky-400 text-[9.5px] font-semibold px-2 py-0.5 rounded border border-sky-800">
                          ⚡ Lowest Power
                        </span>
                      )}
                      {isBestOverallResources && (
                        <span className="bg-purple-950/70 text-purple-300 text-[9.5px] font-semibold px-2 py-0.5 rounded border border-purple-800">
                          💎 Lowest Overall Resources
                        </span>
                      )}
                      {lowestResBadges.map((badgeName) => (
                        <span
                          key={badgeName}
                          className="bg-teal-950/70 text-teal-300 text-[9.5px] font-semibold px-2 py-0.5 rounded border border-teal-800"
                        >
                          🌿 Lowest {badgeName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Comparison Table View */}
      {viewMode === "table" && (
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800">
              <tr>
                <th className="px-3 py-2">Recipe Configuration</th>
                <th className="px-3 py-2">Target Output (/min)</th>
                <th className="px-3 py-2">Machines</th>
                <th className="px-3 py-2">Power (MW)</th>
                <th className="px-3 py-2">Raw Resources Consumed</th>
                <th className="px-3 py-2">Resource Score</th>
                <th className="px-3 py-2">Best Performance Badges</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {variants.map((variant) => {
                const isSelected = variant.label === selectedLabel;
                const isBestMachine = variant.label === bestMachines;
                const isBestPower = variant.label === bestPower;
                const vScore = variantScores[variant.label] ?? 0;
                const isBestOverallResources = Math.abs(vScore - minScore) < 0.05 && vScore > 0;

                const lowestResBadges: string[] = [];
                Object.entries(perResourceMins).forEach(([res, info]) => {
                  if (info.bestLabels.has(variant.label)) {
                    const cleanName = formatItemName(res).replace(/ Ore/i, "");
                    lowestResBadges.push(cleanName);
                  }
                });

                const outputs = Object.entries(variant.target_outputs || {});
                const totalOut = outputs.reduce((sum, [_, r]) => sum + r, 0);
                const isBestOut = totalOut >= bestOutput - 1e-4 && totalOut > 0;

                const resourcesUsed = Object.entries(variant.resource_usage || {});

                return (
                  <tr
                    key={variant.label}
                    className={`hover:bg-slate-800/50 transition-colors ${
                      isSelected ? "bg-sky-950/30" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-sans font-medium text-white">
                      <div className="flex items-center gap-2">
                        {isSelected && <span className="text-sky-400 text-xs">●</span>}
                        <span>{variant.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={isBestOut ? "text-emerald-400 font-bold" : "text-slate-300"}>
                        {outputs
                          .map(([item, rate]) => `${rate.toFixed(1)}/m ${formatItemName(item)}`)
                          .join(", ") || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={isBestMachine ? "text-emerald-400 font-bold" : "text-slate-300"}>
                        {variant.total_machines}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={isBestPower ? "text-emerald-400 font-bold" : "text-slate-300"}>
                        {variant.total_power_mw.toFixed(1)} MW
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px]">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {resourcesUsed.map(([r, rate]) => (
                          <span key={r} className="text-slate-300">
                            {rate.toFixed(0)}/m {formatItemName(r).replace(/ Ore/i, "")}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`font-bold ${isBestOverallResources ? "text-purple-400" : "text-slate-300"}`}>
                        {vScore.toFixed(0)} pts
                      </span>
                    </td>
                    <td className="px-3 py-2 font-sans">
                      <div className="flex flex-wrap gap-1">
                        {isBestMachine && (
                          <span className="bg-emerald-950/70 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded border border-emerald-800">
                            Fewest Machines
                          </span>
                        )}
                        {isBestPower && (
                          <span className="bg-sky-950/70 text-sky-400 text-[9px] px-1.5 py-0.5 rounded border border-sky-800">
                            Lowest Power
                          </span>
                        )}
                        {isBestOverallResources && (
                          <span className="bg-purple-950/70 text-purple-300 text-[9px] px-1.5 py-0.5 rounded border border-purple-800">
                            Lowest Overall Resources
                          </span>
                        )}
                        {lowestResBadges.map((badgeName) => (
                          <span
                            key={badgeName}
                            className="bg-teal-950/70 text-teal-300 text-[9px] px-1.5 py-0.5 rounded border border-teal-800"
                          >
                            Lowest {badgeName}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => onSelectVariant(variant)}
                        className={`px-3 py-1 rounded text-xs font-sans font-medium transition-colors ${
                          isSelected
                            ? "bg-sky-600 text-white font-semibold"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                        }`}
                      >
                        {isSelected ? "Active" : "Apply"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
