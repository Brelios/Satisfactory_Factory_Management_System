"use client";
import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getItemColor } from "@/lib/colors";

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
}

const MachineNode = ({ data }: NodeProps) => {
  const nodeData = data as MachineNodeData;
  const normalCount =
    nodeData.normalMachineCount ??
    (nodeData.clockSpeed >= 99.9
      ? nodeData.machineCount
      : Math.max(0, nodeData.machineCount - 1));
  const underCount =
    nodeData.underclockedMachineCount ??
    (nodeData.clockSpeed >= 99.9 ? 0 : 1);
  const underClock = nodeData.underclockClockSpeed ?? nodeData.clockSpeed;

  const inputEntries = Object.entries(nodeData.inputRates || {});
  const outputEntries = Object.entries(nodeData.outputRates || {});

  // Primary output item color for the card's accent
  const primaryOutput = outputEntries[0]?.[0] || "";
  const accentColor = getItemColor(primaryOutput) || nodeData.chainColor || "#475569";

  return (
    <div className="relative z-20 bg-slate-900 border-2 border-slate-700/80 rounded-xl w-[260px] text-white shadow-2xl overflow-hidden flex flex-col transition-all hover:border-slate-500 hover:shadow-sky-950/30 select-none">
      {/* Dynamic item-specific target handles on left border */}
      {inputEntries.length > 0 ? (
        inputEntries.map(([item, rate], idx) => {
          const topPercent =
            inputEntries.length === 1
              ? 50
              : 30 + (idx / (inputEntries.length - 1)) * 40; // 30% to 70%
          const itemColor = getItemColor(item);
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
              className="w-3.5 h-3.5 border-2 !-left-2 transition-transform hover:scale-125"
              title={`Input: ${item.replace(/_/g, " ")} (${rate.toFixed(1)}/m)`}
            />
          );
        })
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3.5 h-3.5 bg-slate-400 border-2 border-slate-900 !-left-2"
        />
      )}

      {/* Top Header with Accent Stripe */}
      <div className="px-3.5 pt-3 pb-2 border-b border-slate-800 bg-slate-950/50">
        <div className="flex justify-between items-start gap-2 mb-1">
          <div className="font-bold text-sm text-white leading-tight truncate" title={nodeData.label}>
            {nodeData.label}
          </div>
          <span className="text-[10px] text-amber-400 font-mono bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/60 shrink-0 font-medium">
            ⚡ {nodeData.powerMw.toFixed(1)} MW
          </span>
        </div>

        <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: accentColor }}
          />
          <span className="capitalize">{nodeData.machine}</span>
          <span className="text-slate-500">&times;</span>
          <span className="text-white font-mono font-bold">{nodeData.machineCount} Total</span>
        </div>
      </div>

      {/* Body: Operating Breakdown & In/Out Rates */}
      <div className="p-3 space-y-2.5">
        {/* Machine Operating Setup */}
        <div className="bg-slate-950/70 rounded-lg p-2 text-[10px] border border-slate-800/80 space-y-1 font-mono">
          <div className="flex justify-between items-center text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>{normalCount}&times; Normal</span>
            </span>
            <span className="text-emerald-400 font-semibold">@ 100%</span>
          </div>

          {underCount > 0 && (
            <div className="flex justify-between items-center text-amber-200 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-800/40">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                <span>{underCount}&times; Underclocked</span>
              </span>
              <span className="text-amber-400 font-bold">
                ⏱ {underClock.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Inputs and Outputs Table */}
        <div className="grid grid-cols-2 gap-2 text-[10px] pt-0.5">
          {/* Inputs Column */}
          <div className="space-y-1">
            <div className="text-slate-500 font-semibold text-[9px] uppercase tracking-wider border-b border-slate-800 pb-0.5">
              Inputs (/m)
            </div>
            {inputEntries.length > 0 ? (
              inputEntries.map(([item, rate]) => (
                <div key={item} className="flex justify-between items-center font-mono">
                  <span
                    className="truncate max-w-[65px] capitalize text-slate-300"
                    title={item.replace(/_/g, " ")}
                  >
                    {item.replace(/_/g, " ")}
                  </span>
                  <span
                    className="font-semibold"
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
            <div className="text-slate-500 font-semibold text-[9px] uppercase tracking-wider border-b border-slate-800 pb-0.5">
              Outputs (/m)
            </div>
            {outputEntries.map(([item, rate]) => (
              <div key={item} className="flex justify-between items-center font-mono">
                <span
                  className="truncate max-w-[65px] capitalize text-slate-300"
                  title={item.replace(/_/g, " ")}
                >
                  {item.replace(/_/g, " ")}
                </span>
                <span
                  className="font-semibold"
                  style={{ color: getItemColor(item) }}
                >
                  {rate.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
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
        className="w-3.5 h-3.5 border-2 !-right-2 transition-transform hover:scale-125"
        title={`Output: ${primaryOutput.replace(/_/g, " ")}`}
      />
    </div>
  );
};

export default memo(MachineNode);
