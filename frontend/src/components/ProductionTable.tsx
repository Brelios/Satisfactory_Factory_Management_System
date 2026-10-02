"use client";
import React, { useState } from "react";
import type { ProductionStep, BeltConnection } from "@/lib/types";

export default function ProductionTable({
  steps,
  connections,
}: {
  steps: ProductionStep[];
  connections: BeltConnection[];
}) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const exportCSV = () => {
    if (!steps.length) return;

    const headers = [
      "Recipe",
      "Building",
      "Total Machines",
      "Breakdown",
      "Power (MW)",
      "Inputs",
      "Outputs",
    ];

    const rows = steps.map((s) => {
      const normalCount =
        s.normal_machine_count ??
        (s.clock_speed >= 99.9 ? s.machine_count : Math.max(0, s.machine_count - 1));
      const underCount =
        s.underclocked_machine_count ?? (s.clock_speed >= 99.9 ? 0 : 1);
      const underClock = s.underclock_clock_speed ?? s.clock_speed;

      const breakdown =
        underCount > 0
          ? `${normalCount} @ 100% + ${underCount} @ ${underClock.toFixed(1)}%`
          : `${normalCount} @ 100%`;

      const inRates = Object.entries(s.input_rates)
        .map(([k, v]) => `${k}:${v.toFixed(1)}/m`)
        .join("; ");
      const outRates = Object.entries(s.output_rates)
        .map(([k, v]) => `${k}:${v.toFixed(1)}/m`)
        .join("; ");

      return [
        `"${s.recipe_name}"`,
        `"${s.machine}"`,
        s.machine_count,
        `"${breakdown}"`,
        s.power_mw.toFixed(1),
        `"${inRates}"`,
        `"${outRates}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "satisfactory_bill_of_materials.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!steps.length) return null;

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-700/80 overflow-hidden shadow-xl mt-1 select-none">
      {/* Table Header Controls */}
      <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h3 className="text-sm font-bold text-white tracking-wide">
            Bill of Materials &amp; Production Line Breakdown
          </h3>
          <span className="text-xs text-slate-400 font-mono ml-2">
            ({steps.length} production stages)
          </span>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 rounded-lg border border-slate-700 text-xs font-mono font-medium transition-colors shadow-sm"
          title="Download production breakdown as CSV"
        >
          <span>📥</span>
          <span>Export CSV</span>
        </button>
      </div>

      <div className="overflow-x-auto max-h-60">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
            <tr>
              <th className="px-4 py-2.5">Recipe</th>
              <th className="px-4 py-2.5">Machine</th>
              <th className="px-4 py-2.5">Operating Breakdown</th>
              <th className="px-4 py-2.5">Power</th>
              <th className="px-4 py-2.5 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {steps.map((step) => {
              const isExpanded = expandedRows[step.step_id];
              const normalCount =
                step.normal_machine_count ??
                (step.clock_speed >= 99.9
                  ? step.machine_count
                  : Math.max(0, step.machine_count - 1));
              const underCount =
                step.underclocked_machine_count ??
                (step.clock_speed >= 99.9 ? 0 : 1);
              const underClock = step.underclock_clock_speed ?? step.clock_speed;

              const incomingConnections = connections.filter(
                (c) => c.to_step === step.step_id
              );

              return (
                <React.Fragment key={step.step_id}>
                  <tr className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-white">
                      {step.recipe_name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 capitalize">
                      {step.machine.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {underCount > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-bold">
                            {step.machine_count} &times;
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="text-emerald-400">
                            {normalCount} @ 100%
                          </span>
                          <span className="text-slate-500">+</span>
                          <span className="text-amber-400 font-medium">
                            {underCount} @ {underClock.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                          <span className="text-white font-bold">
                            {step.machine_count} &times;
                          </span>
                          <span>@ 100% (Normal)</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-amber-400 font-mono font-medium">
                      ⚡ {step.power_mw.toFixed(1)} MW
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => toggleRow(step.step_id)}
                        className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                      >
                        {isExpanded ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-slate-950/60">
                      <td colSpan={5} className="px-4 py-3 space-y-3">
                        <div className="grid grid-cols-2 gap-6 text-xs font-mono">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 border-b border-slate-800 pb-0.5">
                              Inputs Consumed (/min)
                            </div>
                            <div className="space-y-1">
                              {Object.entries(step.input_rates).map(
                                ([item, rate]) => (
                                  <div
                                    key={item}
                                    className="flex justify-between"
                                  >
                                    <span className="text-slate-300 capitalize">
                                      {item.replace(/_/g, " ")}
                                    </span>
                                    <span className="text-amber-400 font-semibold">
                                      {rate.toFixed(1)}/m
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 border-b border-slate-800 pb-0.5">
                              Outputs Produced (/min)
                            </div>
                            <div className="space-y-1">
                              {Object.entries(step.output_rates).map(
                                ([item, rate]) => (
                                  <div
                                    key={item}
                                    className="flex justify-between"
                                  >
                                    <span className="text-slate-300 capitalize">
                                      {item.replace(/_/g, " ")}
                                    </span>
                                    <span className="text-emerald-400 font-semibold">
                                      {rate.toFixed(1)}/m
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Incoming Conveyor Feeds Breakdown */}
                        {incomingConnections.length > 0 && (
                          <div className="border-t border-slate-800 pt-2">
                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                              Incoming Conveyors &amp; Machine Feeds
                            </div>
                            <div className="space-y-1">
                              {incomingConnections.map((conn, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between items-center bg-slate-900 px-2 py-1 rounded text-xs font-mono border border-slate-800"
                                >
                                  <div>
                                    <span className="text-white capitalize">
                                      {conn.item.replace(/_/g, " ")}
                                    </span>
                                    <span className="text-slate-500 mx-1.5">
                                      &bull;
                                    </span>
                                    <span className="text-sky-400">
                                      {conn.belt_count > 1
                                        ? `${conn.belt_count}× Mk.${conn.belt_tier} (${conn.rate.toFixed(1)}/m)`
                                        : `Mk.${conn.belt_tier} (${conn.rate.toFixed(1)}/m)`}
                                    </span>
                                  </div>
                                  <span className="text-amber-300">
                                    {conn.feed_description ||
                                      `Feeds ${conn.rate.toFixed(1)}/m`}
                                  </span>
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
