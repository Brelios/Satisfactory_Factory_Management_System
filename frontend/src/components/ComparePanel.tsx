"use client";
import React from "react";
import type { CompareVariant } from "@/lib/types";

interface ComparePanelProps {
  variants: CompareVariant[] | null;
  isLoading: boolean;
  onSelectVariant: (variant: CompareVariant) => void;
  selectedLabel: string | null;
  bestMachines: string;
  bestPower: string;
}

export default function ComparePanel({ variants, isLoading, onSelectVariant, selectedLabel, bestMachines, bestPower }: ComparePanelProps) {
  if (isLoading) {
    return (
      <div className="w-full h-32 bg-slate-800/50 rounded-lg border border-slate-700 flex items-center justify-center">
        <div className="animate-pulse text-sky-400">Comparing alternatives...</div>
      </div>
    );
  }

  if (!variants || variants.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="flex gap-4 w-max">
        {variants.map(variant => {
          const isSelected = variant.label === selectedLabel;
          const isBestMachine = variant.label === bestMachines;
          const isBestPower = variant.label === bestPower;

          return (
            <div 
              key={variant.label}
              onClick={() => onSelectVariant(variant)}
              className={`w-64 p-4 rounded-lg cursor-pointer transition-all ${
                isSelected 
                  ? 'bg-slate-800 border-2 border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.3)]' 
                  : 'bg-slate-800/70 border border-slate-700 hover:border-slate-500'
              }`}
            >
              <div className="font-bold text-white mb-2">{variant.label}</div>
              
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Machines</span>
                  <span className={`font-mono ${isBestMachine ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                    {variant.total_machines}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Power</span>
                  <span className={`font-mono ${isBestPower ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                    {variant.total_power_mw.toFixed(1)} MW
                  </span>
                </div>
                
                <div className="mt-2 pt-2 border-t border-slate-700 flex flex-wrap gap-1">
                  {isBestMachine && <span className="bg-emerald-900/50 text-emerald-400 text-[10px] px-2 py-0.5 rounded border border-emerald-800">Fewest Machines</span>}
                  {isBestPower && <span className="bg-emerald-900/50 text-emerald-400 text-[10px] px-2 py-0.5 rounded border border-emerald-800">Lowest Power</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
