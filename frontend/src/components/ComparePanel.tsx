"use client";
import React from "react";
import type { CompareVariant } from "@/lib/types";
import { formatItemName } from "@/lib/colors";

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
  if (isLoading) {
    return (
      <div className="w-full h-24 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-center">
        <div className="animate-pulse text-sky-400 text-sm font-medium">
          ⚙️ Comparing alternative recipe configurations...
        </div>
      </div>
    );
  }

  if (!variants || variants.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto pb-2 shrink-0">
      <div className="flex gap-3 w-max">
        {variants.map((variant) => {
          const isSelected = variant.label === selectedLabel;
          const isBestMachine = variant.label === bestMachines;
          const isBestPower = variant.label === bestPower;

          const outputs = Object.entries(variant.target_outputs || {});

          return (
            <div
              key={variant.label}
              onClick={() => onSelectVariant(variant)}
              className={`w-64 p-3.5 rounded-xl cursor-pointer transition-all select-none ${
                isSelected
                  ? "bg-slate-900 border-2 border-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.35)]"
                  : "bg-slate-900/80 border border-slate-700/80 hover:border-slate-500"
              }`}
            >
              <div className="font-bold text-white text-sm mb-2 leading-tight truncate" title={variant.label}>
                {variant.label}
              </div>

              <div className="flex flex-col gap-1.5 text-xs">
                {/* Target Output Quota */}
                {outputs.length > 0 && (
                  <div className="flex justify-between items-center bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                    <span className="text-slate-400">Target Output:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {outputs[0][1].toFixed(1)}/m {formatItemName(outputs[0][0])}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Machines:</span>
                  <span
                    className={`font-mono ${
                      isBestMachine ? "text-emerald-400 font-bold" : "text-slate-200"
                    }`}
                  >
                    {variant.total_machines}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Power:</span>
                  <span
                    className={`font-mono ${
                      isBestPower ? "text-emerald-400 font-bold" : "text-slate-200"
                    }`}
                  >
                    {variant.total_power_mw.toFixed(1)} MW
                  </span>
                </div>

                <div className="mt-1 pt-1.5 border-t border-slate-800 flex flex-wrap gap-1">
                  {isBestMachine && (
                    <span className="bg-emerald-950/60 text-emerald-400 text-[10px] font-medium px-2 py-0.5 rounded border border-emerald-800">
                      🏭 Fewest Machines
                    </span>
                  )}
                  {isBestPower && (
                    <span className="bg-sky-950/60 text-sky-400 text-[10px] font-medium px-2 py-0.5 rounded border border-sky-800">
                      ⚡ Lowest Power
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
