"use client";
import React, { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getItemColor } from "@/lib/colors";
import type { PhysicalMachine } from "@/lib/types";

export interface MachineNodeData extends Record<string, unknown> {
  label: string;
  machine: string;
  machineCount: number;
  clockSpeed: number;
  inputRates: Record<string, number>;
  outputRates: Record<string, number>;
  powerMw: number;
  chainColor: string;
  recipeId: string;
  normalMachineCount?: number;
  underclockedMachineCount?: number;
  underclockClockSpeed?: number;
  physicalMachines?: PhysicalMachine[];
  isHighlighted?: boolean;
  inputItemOrder?: string[];
  inputFeedCounts?: Record<string, number>;
}

function formatClock(clk: number): string {
  if (Math.abs(clk - Math.round(clk)) < 0.001) {
    return `${Math.round(clk)}%`;
  }
  const str = clk.toFixed(3);
  return `${parseFloat(str)}%`;
}

const MachineNode = ({ data }: NodeProps) => {
  const nodeData = data as MachineNodeData;
  const [expanded, setExpanded] = useState(false);

  const normalCount =
    nodeData.normalMachineCount ??
    (nodeData.clockSpeed >= 99.9
      ? nodeData.machineCount
      : Math.max(0, nodeData.machineCount - 1));
  const underCount =
    nodeData.underclockedMachineCount ??
    (nodeData.clockSpeed >= 99.9 ? 0 : 1);
  const underClock = nodeData.underclockClockSpeed ?? nodeData.clockSpeed;

  const rawInputEntries = Object.entries(nodeData.inputRates || {});
  const inputEntries =
    nodeData.inputItemOrder && nodeData.inputItemOrder.length > 0
      ? [...rawInputEntries].sort((a, b) => {
          const idxA = nodeData.inputItemOrder!.indexOf(a[0]);
          const idxB = nodeData.inputItemOrder!.indexOf(b[0]);
          return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
        })
      : rawInputEntries;
  const outputEntries = Object.entries(nodeData.outputRates || {});

  // Primary output item color for the card's accent
  const primaryOutput = outputEntries[0]?.[0] || "";
  const accentColor = getItemColor(primaryOutput) || nodeData.chainColor || "#475569";

  const pMachines = nodeData.physicalMachines || [];
  const hasOverclock = pMachines.some((m) => m.is_overclocked);
  const totalPowerShards = pMachines.reduce((sum, m) => sum + (m.power_shards || 0), 0);

  return (
    <div
      className={`relative z-20 bg-slate-900 border-2 rounded-xl w-[290px] text-white shadow-2xl overflow-hidden flex flex-col transition-all select-none ${
        nodeData.isHighlighted
          ? "border-amber-400 ring-4 ring-amber-500/50 shadow-amber-950/60"
          : "border-slate-700/80 hover:border-slate-500 hover:shadow-sky-950/30"
      }`}
    >
      {/* Dynamic item-specific target handles on left border */}
      {inputEntries.length > 0 ? (
        inputEntries.map(([item, rate], idx) => {
          const topPercent =
            inputEntries.length === 1
              ? 50
              : 30 + (idx / (inputEntries.length - 1)) * 40; // 30% to 70%
          const itemColor = getItemColor(item);
          const feedCount = nodeData.inputFeedCounts?.[item] || 1;

          if (feedCount > 1) {
            return (
              <React.Fragment key={item}>
                {Array.from({ length: feedCount }).map((_, subIdx) => {
                  const subOffset = (subIdx - (feedCount - 1) / 2) * 6;
                  return (
                    <Handle
                      key={`${item}__${subIdx}`}
                      id={`${item}__${subIdx}`}
                      type="target"
                      position={Position.Left}
                      style={{
                        top: `${topPercent + subOffset}%`,
                        backgroundColor: itemColor,
                        borderColor: "#0f172a",
                      }}
                      className="w-3.5 h-3.5 border-2 !-left-2 transition-transform hover:scale-125"
                      title={`Input: ${item.replace(/_/g, " ")} feed ${subIdx + 1} (${rate.toFixed(1)}/m)`}
                    />
                  );
                })}
                {/* Fallback default handle */}
                <Handle
                  id={item}
                  type="target"
                  position={Position.Left}
                  style={{
                    top: `${topPercent}%`,
                    opacity: 0,
                    pointerEvents: "none",
                  }}
                  className="w-1 h-1 !-left-1"
                />
              </React.Fragment>
            );
          }

          return (
            <Handle
              key={item}
              id={item}
              type="target"
              position={Position.Left}
              style={{
                top: `${topPercent}%`,
                backgroundColor: itemColor,
                borderColor: "#0f172a",
              }}
              className="w-4 h-4 border-2 !-left-2 transition-transform hover:scale-125"
              title={`Input: ${item.replace(/_/g, " ")} (${rate.toFixed(1)}/m)`}
            />
          );
        })
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          className="w-4 h-4 bg-slate-400 border-2 border-slate-900 !-left-2"
        />
      )}

      {/* Top Header with Accent Stripe */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-slate-800 bg-slate-950/60">
        <div className="flex justify-between items-start gap-2 mb-1.5">
          <div
            className="font-bold text-sm text-white leading-snug break-words"
            title={nodeData.label}
          >
            {nodeData.label}
          </div>
          <span className="text-[11px] text-amber-400 font-mono bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/60 shrink-0 font-medium whitespace-nowrap">
            ⚡ {nodeData.powerMw.toFixed(1)} MW
          </span>
        </div>

        <div className="text-xs text-slate-300 font-medium flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <span className="capitalize">{nodeData.machine}</span>
            <span className="text-slate-500">&times;</span>
            <span className="text-white font-mono font-bold">
              {nodeData.machineCount} Total
            </span>
          </div>

          {totalPowerShards > 0 && (
            <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-700/80 px-1.5 py-0.5 rounded font-mono shrink-0">
              💎 {totalPowerShards} {totalPowerShards === 1 ? "Shard" : "Shards"}
            </span>
          )}
        </div>
      </div>

      {/* Body: Operating Breakdown & In/Out Rates */}
      <div className="p-3 space-y-2.5">
        {/* Machine Operating Setup */}
        <div className="bg-slate-950/70 rounded-lg p-2.5 text-xs border border-slate-800/80 space-y-1.5 font-mono">
          <div className="flex justify-between items-center text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span>{normalCount}&times; Normal</span>
            </span>
            <span className="text-emerald-400 font-semibold">
              @ {hasOverclock ? "100–250%" : "100%"}
            </span>
          </div>

          {underCount > 0 && (
            <div className="flex justify-between items-center text-amber-200 bg-amber-950/30 px-2 py-1 rounded border border-amber-800/40">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                <span>{underCount}&times; Underclocked</span>
              </span>
              <span className="text-amber-400 font-bold">
                ⏱ {formatClock(underClock)}
              </span>
            </div>
          )}
        </div>

        {/* Inputs and Outputs Table */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
          {/* Inputs Column */}
          <div className="space-y-1">
            <div className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider border-b border-slate-800 pb-0.5">
              Inputs (/m)
            </div>
            {inputEntries.length > 0 ? (
              inputEntries.map(([item, rate]) => (
                <div
                  key={item}
                  className="flex justify-between items-center font-mono gap-1"
                >
                  <span
                    className="truncate capitalize text-slate-300"
                    title={item.replace(/_/g, " ")}
                  >
                    {item.replace(/_/g, " ")}
                  </span>
                  <span
                    className="font-semibold shrink-0"
                    style={{ color: getItemColor(item) }}
                  >
                    {rate.toFixed(1)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-slate-600 italic">None</div>
            )}
          </div>

          {/* Outputs Column */}
          <div className="space-y-1">
            <div className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider border-b border-slate-800 pb-0.5">
              Outputs (/m)
            </div>
            {outputEntries.map(([item, rate]) => (
              <div
                key={item}
                className="flex justify-between items-center font-mono gap-1"
              >
                <span
                  className="truncate capitalize text-slate-300"
                  title={item.replace(/_/g, " ")}
                >
                  {item.replace(/_/g, " ")}
                </span>
                <span
                  className="font-semibold shrink-0"
                  style={{ color: getItemColor(item) }}
                >
                  {rate.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expandable Per-Machine Feed Breakdown */}
        {pMachines.length > 0 && (
          <div className="pt-1 border-t border-slate-800">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between text-[11px] font-mono text-sky-400 hover:text-sky-300 py-1 px-1.5 rounded hover:bg-slate-800/60 transition-colors"
            >
              <span>{expanded ? "▲ Hide Machine Breakdown" : `▼ Feeds (${pMachines.length} Physical Units)`}</span>
              <span className="text-[10px] text-slate-500">{expanded ? "Collapse" : "Expand"}</span>
            </button>

            {expanded && (
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10.5px]">
                {pMachines.map((m) => {
                  const inputStatuses = Object.values(m.inputs || {});
                  const isSatisfied = inputStatuses.every((i) => i.status === "satisfied" || i.status === "underclocked");
                  const feedsDesc = Object.entries(m.inputs || {})
                    .map(([item, inp]) => {
                      const feedParts = inp.feeds.map((f) => `${f.rate.toFixed(0)} (${f.source.replace(/^source_trunk_/, "").replace(/^splitter_/, "S-")})`);
                      return `${inp.received.toFixed(0)}/${inp.demand.toFixed(0)} ${item.replace(/_/g, " ")} [${feedParts.join(" + ")}]`;
                    })
                    .join("; ");

                  return (
                    <div
                      key={m.machine_id}
                      className="bg-slate-950/80 p-2 rounded border border-slate-800/80 space-y-1"
                    >
                      <div className="flex justify-between items-center text-slate-300 font-semibold">
                        <span className="capitalize">
                          #{m.index_in_step} {m.machine_type}
                        </span>
                        <span
                          className={
                            m.clock_speed < 99.9
                              ? "text-amber-400"
                              : m.clock_speed > 100.1
                              ? "text-purple-400"
                              : "text-emerald-400"
                          }
                        >
                          @{formatClock(m.clock_speed)}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[10px] leading-tight">
                        {feedsDesc || "No feeds required"}
                      </div>
                      <div className="flex justify-between items-center text-[9.5px]">
                        <span
                          className={
                            isSatisfied
                              ? "text-emerald-400 font-medium"
                              : "text-red-400 font-bold"
                          }
                        >
                          {isSatisfied ? "✓ Fully Fed" : "⚠️ Shortfall"}
                        </span>
                        <span className="text-slate-500">{m.power_mw.toFixed(1)} MW</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Primary Output Handle on right border */}
      <Handle
        id="output"
        type="source"
        position={Position.Right}
        style={{
          backgroundColor: accentColor,
          borderColor: "#0f172a",
        }}
        className="w-4 h-4 border-2 !-right-2 transition-transform hover:scale-125"
        title={`Output: ${primaryOutput.replace(/_/g, " ")}`}
      />
    </div>
  );
};

export default memo(MachineNode);
