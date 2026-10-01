"use client";
import React, { useState } from "react";
import type { ProductionStep, BeltConnection } from "@/lib/types";

export default function ProductionTable({ steps, connections }: { steps: ProductionStep[], connections: BeltConnection[] }) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!steps.length) return null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden mt-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Recipe</th>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Count</th>
              <th className="px-4 py-3">Clock</th>
              <th className="px-4 py-3">Power</th>
              <th className="px-4 py-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {steps.map((step) => {
              const isExpanded = expandedRows[step.step_id];
              return (
                <React.Fragment key={step.step_id}>
                  <tr className="hover:bg-slate-800/80 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{step.recipe_name}</td>
                    <td className="px-4 py-3 text-slate-300 capitalize">{step.machine.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-slate-300">{step.machine_count}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {step.clock_speed.toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-sky-400 font-mono">{step.power_mw.toFixed(1)} MW</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => toggleRow(step.step_id)}
                        className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
                      >
                        {isExpanded ? "Hide" : "Show"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-900/30">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Inputs</h4>
                            <div className="space-y-1">
                              {Object.entries(step.input_rates).map(([item, rate]) => (
                                <div key={item} className="flex justify-between text-sm">
                                  <span className="text-slate-300 capitalize">{item.replace(/_/g, ' ')}</span>
                                  <span className="text-amber-500 font-mono">{rate.toFixed(1)}/m</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Outputs</h4>
                            <div className="space-y-1">
                              {Object.entries(step.output_rates).map(([item, rate]) => (
                                <div key={item} className="flex justify-between text-sm">
                                  <span className="text-slate-300 capitalize">{item.replace(/_/g, ' ')}</span>
                                  <span className="text-emerald-500 font-mono">{rate.toFixed(1)}/m</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
