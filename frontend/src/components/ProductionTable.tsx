"use client";

import React, { useState } from "react";
import { ProductionStep, BeltConnection } from "@/lib/types";
import { ChevronDown, ChevronRight, Zap, ArrowRight } from "lucide-react";

interface ProductionTableProps {
  steps: ProductionStep[];
  connections: BeltConnection[];
}

export function ProductionTable({ steps, connections }: ProductionTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (stepId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  const getRowColor = (recipeName: string) => {
    const lower = recipeName.toLowerCase();
    if (lower.includes("iron")) return "border-l-amber-600";
    if (lower.includes("copper")) return "border-l-orange-500";
    if (lower.includes("steel")) return "border-l-slate-400";
    return "border-l-sky-500";
  };

  const getStepConnections = (stepId: string) => {
    const inputs = connections.filter((c) => c.to_step === stepId);
    const outputs = connections.filter((c) => c.from_step === stepId);
    return { inputs, outputs };
  };

  return (
    <div className="w-full bg-slate-800 rounded-lg border border-slate-700 overflow-hidden text-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-900/50 border-b border-slate-700 text-slate-300">
            <th className="py-3 px-4 font-semibold">Recipe</th>
            <th className="py-3 px-4 font-semibold">Machine</th>
            <th className="py-3 px-4 font-semibold">Clock %</th>
            <th className="py-3 px-4 font-semibold">Inputs</th>
            <th className="py-3 px-4 font-semibold">Outputs</th>
            <th className="py-3 px-4 font-semibold text-right">Power</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {steps.map((step) => {
            const isExpanded = expandedRows[step.step_id];
            const rowColor = getRowColor(step.recipe_name);
            const { inputs: connInputs, outputs: connOutputs } = getStepConnections(step.step_id);

            return (
              <React.Fragment key={step.step_id}>
                <tr
                  onClick={() => toggleRow(step.step_id)}
                  className={\`border-l-4 \${rowColor} hover:bg-slate-700/50 cursor-pointer transition-colors\`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      {isExpanded ? (
                        <ChevronDown size={16} className="text-slate-400" />
                      ) : (
                        <ChevronRight size={16} className="text-slate-400" />
                      )}
                      <span className="font-medium text-white">{step.recipe_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-300">{step.machine}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-700 text-xs font-mono text-slate-300">
                        x{step.machine_count}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col space-y-1 w-24">
                      <span className="text-xs text-slate-400 font-mono">
                        {Math.round(step.clock_speed * 100)}%
                      </span>
                      <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-500 rounded-full"
                          style={{ width: \`\${Math.min(step.clock_speed * 100, 100)}%\` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col space-y-1">
                      {Object.entries(step.input_rates).map(([item, rate]) => (
                        <div key={item} className="text-slate-300 text-xs">
                          <span className="font-mono text-orange-400">{rate.toFixed(1)}/min</span> {item}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col space-y-1">
                      {Object.entries(step.output_rates).map(([item, rate]) => (
                        <div key={item} className="text-slate-300 text-xs">
                          <span className="font-mono text-emerald-400">{rate.toFixed(1)}/min</span> {item}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1 text-yellow-500">
                      <span className="font-mono">{step.power_mw.toFixed(1)}</span>
                      <Zap size={14} />
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-slate-900/30">
                    <td colSpan={6} className="py-4 px-8">
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                            Incoming Belts
                          </h4>
                          {connInputs.length > 0 ? (
                            <ul className="space-y-2">
                              {connInputs.map((conn, idx) => (
                                <li key={idx} className="flex items-center text-xs text-slate-300">
                                  <span className="text-slate-500 mr-2">{conn.from_step}</span>
                                  <ArrowRight size={12} className="text-slate-500 mr-2" />
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 mr-2">
                                    Mk.{conn.belt_tier}
                                  </span>
                                  <span className="font-mono text-orange-400 mr-1">{conn.rate.toFixed(1)}</span>
                                  <span>{conn.item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Raw resource input (no incoming belt)</span>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                            Outgoing Belts
                          </h4>
                          {connOutputs.length > 0 ? (
                            <ul className="space-y-2">
                              {connOutputs.map((conn, idx) => (
                                <li key={idx} className="flex items-center text-xs text-slate-300">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 mr-2">
                                    Mk.{conn.belt_tier}
                                  </span>
                                  <span className="font-mono text-emerald-400 mr-1">{conn.rate.toFixed(1)}</span>
                                  <span className="mr-2">{conn.item}</span>
                                  <ArrowRight size={12} className="text-slate-500 mr-2" />
                                  <span className="text-slate-500">{conn.to_step}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-slate-500 italic">End product (no outgoing belt)</span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {steps.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-slate-500">
                No production steps generated yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
