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
}

const MachineNode = ({ data }: NodeProps<any>) => {
  const nodeData = data as MachineNodeData;

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg min-w-[200px] text-white shadow-lg overflow-hidden flex transition-transform hover:scale-[1.02] hover:shadow-xl">
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-slate-400" />
      
      {/* Colored side stripe */}
      <div className="w-2 shrink-0" style={{ backgroundColor: nodeData.chainColor || "#475569" }} />
      
      <div className="flex-1 p-3">
        <div className="font-bold text-sm mb-1">{nodeData.label}</div>
        <div className="text-xs text-slate-400 mb-2">
          {nodeData.machine} &times; {nodeData.machineCount}
        </div>
        
        <div className="flex justify-between items-center text-xs mb-2">
          <span className={nodeData.clockSpeed !== 100 ? "text-yellow-500 font-medium" : "text-slate-300"}>
            ⏱ {nodeData.clockSpeed.toFixed(0)}%
          </span>
          <span className="text-sky-400 font-medium">⚡ {nodeData.powerMw.toFixed(1)} MW</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <div className="text-slate-500 font-semibold mb-1 border-b border-slate-700">Inputs</div>
            {Object.entries(nodeData.inputRates).map(([item, rate]) => (
              <div key={item} className="flex justify-between">
                <span className="text-slate-300 truncate mr-2" title={item}>{item.replace(/_/g, ' ')}</span>
                <span className="text-slate-400">{rate.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-slate-500 font-semibold mb-1 border-b border-slate-700">Outputs</div>
            {Object.entries(nodeData.outputRates).map(([item, rate]) => (
              <div key={item} className="flex justify-between">
                <span className="text-slate-300 truncate mr-2" title={item}>{item.replace(/_/g, ' ')}</span>
                <span className="text-emerald-400">{rate.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-slate-400" />
    </div>
  );
};

export default memo(MachineNode);
