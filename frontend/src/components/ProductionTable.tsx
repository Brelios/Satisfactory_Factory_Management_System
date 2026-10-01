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
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden mt-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900/70 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Recipe</th>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Total Count</th>
              <th className="px-4 py-3">Operating Setup (Clocking)</th>
              <th className="px-4 py-3">Power</th>
              <th className="px-4 py-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {steps.map((step) => {
              const isExpanded = expandedRows[step.step_id];
              const normalCount = step.normal_machine_count ?? (step.clock_speed >= 99.9 ? step.machine_count : Math.max(0, step.machine_count - 1));
              const underCount = step.underclocked_machine_count ?? (step.clock_speed >= 99.9 ? 0 : 1);
              const underClock = step.underclock_clock_speed ?? step.clock_speed;

              // Incoming connections feeding this step
              const incomingConnections = connections.filter(c => c.to_step === step.step_id);

              return (
                <React.Fragment key={step.step_id}>
                  <tr className="hover:bg-slate-800/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">{step.recipe_name}</td>
                    <td className="px-4 py-3 text-slate-300 capitalize">{step.machine.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono font-medium">{step.machine_count}</td>
                    <td className="px-4 py-3 text-xs font-mono">
                      {underCount > 0 ? (
                        <div className="space-y-0.5">
                          <div className="text-slate-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>{normalCount}&times; @ 100% (Normal)</span>
                          </div>
                          <div className="text-amber-400 font-semibold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            <span>{underCount}&times; @ {underClock.toFixed(1)}% (Underclocked)</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-emerald-400 font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>{normalCount}&times; @ 100% (Normal)</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sky-400 font-mono">{step.power_mw.toFixed(1)} MW</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => toggleRow(step.step_id)}
                        className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
                      >
                        {isExpanded ? "Hide Details" : "Show Details"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-900/40">
                      <td colSpan={6} className="px-4 py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Item Inputs Consumed</h4>
                            <div className="space-y-1">
                              {Object.entries(step.input_rates).map(([item, rate]) => (
                                <div key={item} className="flex justify-between text-xs font-mono">
                                  <span className="text-slate-300 capitalize">{item.replace(/_/g, ' ')}</span>
                                  <span className="text-amber-400 font-semibold">{rate.toFixed(1)}/m</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Item Outputs Produced</h4>
                            <div className="space-y-1">
                              {Object.entries(step.output_rates).map(([item, rate]) => (
                                <div key={item} className="flex justify-between text-xs font-mono">
                                  <span className="text-slate-300 capitalize">{item.replace(/_/g, ' ')}</span>
                                  <span className="text-emerald-400 font-semibold">{rate.toFixed(1)}/m</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Incoming Conveyor Feeds Breakdown */}
                        {incomingConnections.length > 0 && (
                          <div className="border-t border-slate-700/60 pt-3">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Incoming Conveyor Belts &amp; Machine Feed Distribution</h4>
                            <div className="space-y-1.5">
                              {incomingConnections.map((conn, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs bg-slate-800/80 p-2 rounded border border-slate-700 font-mono">
                                  <div>
                                    <span className="text-white font-medium capitalize">{conn.item.replace(/_/g, ' ')}</span>
                                    <span className="text-slate-400 mx-2">&bull;</span>
                                    <span className="text-sky-400">
                                      {conn.belt_count > 1 ? `${conn.belt_count}× Mk.${conn.belt_tier} (${conn.rate.toFixed(1)}/m)` : `Mk.${conn.belt_tier} (${conn.rate.toFixed(1)}/m)`}
                                    </span>
                                  </div>
                                  <div className="text-amber-300 font-medium">
                                    {conn.feed_description || `Feeds ${conn.rate.toFixed(1)}/m`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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
