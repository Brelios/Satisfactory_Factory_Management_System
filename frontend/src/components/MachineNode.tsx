"use client";
import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

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

const MachineNode = ({ data }: NodeProps<any>) => {
  const nodeData = data as MachineNodeData;
  const normalCount = nodeData.normalMachineCount ?? (nodeData.clockSpeed >= 99.9 ? nodeData.machineCount : Math.max(0, nodeData.machineCount - 1));
  const underCount = nodeData.underclockedMachineCount ?? (nodeData.clockSpeed >= 99.9 ? 0 : 1);
  const underClock = nodeData.underclockClockSpeed ?? nodeData.clockSpeed;

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg min-w-[220px] text-white shadow-xl overflow-hidden flex transition-transform hover:scale-[1.02]">
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-slate-400 border border-slate-900" />
      
      {/* Colored side stripe */}
      <div className="w-2.5 shrink-0" style={{ backgroundColor: nodeData.chainColor || "#475569" }} />
      
      <div className="flex-1 p-3">
        <div className="flex justify-between items-start mb-1">
          <div className="font-bold text-sm text-white">{nodeData.label}</div>
          <span className="text-[10px] text-sky-400 font-mono bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800">
            ⚡ {nodeData.powerMw.toFixed(1)} MW
          </span>
        </div>

        <div className="text-xs text-slate-300 mb-2 font-medium">
          {nodeData.machine} &times; {nodeData.machineCount} Total
        </div>

        {/* Machine Operating Breakdown */}
        <div className="bg-slate-900/80 rounded p-1.5 mb-2.5 text-[10px] border border-slate-700/60 space-y-1 font-mono">
          <div className="flex justify-between items-center text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>{normalCount}&times; Normal</span>
            </span>
            <span className="text-emerald-400 font-semibold">@ 100%</span>
          </div>

          {underCount > 0 && (
            <div className="flex justify-between items-center text-amber-200 bg-amber-950/40 px-1 py-0.5 rounded border border-amber-800/50">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span>{underCount}&times; Underclocked</span>
              </span>
              <span className="text-amber-400 font-bold">
                ⏱ {underClock.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        
        {/* Input & Output Rates */}
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <div className="text-slate-500 font-semibold mb-1 border-b border-slate-700 pb-0.5">Inputs (/m)</div>
            {Object.entries(nodeData.inputRates).map(([item, rate]) => (
              <div key={item} className="flex justify-between font-mono">
                <span className="text-slate-300 truncate mr-1" title={item}>{item.replace(/_/g, ' ')}</span>
                <span className="text-amber-400">{rate.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-slate-500 font-semibold mb-1 border-b border-slate-700 pb-0.5">Outputs (/m)</div>
            {Object.entries(nodeData.outputRates).map(([item, rate]) => (
              <div key={item} className="flex justify-between font-mono">
                <span className="text-slate-300 truncate mr-1" title={item}>{item.replace(/_/g, ' ')}</span>
                <span className="text-emerald-400">{rate.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-slate-400 border border-slate-900" />
    </div>
  );
};

export default memo(MachineNode);
