"use client";
import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getItemColor, formatItemName } from "@/lib/colors";

export interface OutputNodeData extends Record<string, unknown> {
  label: string;
  rate: number;
}

const OutputNode = ({ data }: NodeProps) => {
  const nodeData = data as OutputNodeData;
  const color = getItemColor(nodeData.label) || "#10b981";
  const name = formatItemName(nodeData.label);

  return (
    <div
      className="relative z-20 bg-slate-900 border-2 rounded-2xl px-4 py-3 flex flex-col items-center justify-center text-center shadow-xl transition-all hover:scale-105 min-w-[130px] select-none"
      style={{ borderColor: color }}
    >
      <Handle
        id="input"
        type="target"
        position={Position.Left}
        style={{ backgroundColor: color, borderColor: "#0f172a" }}
        className="w-3.5 h-3.5 border-2 !-left-2"
        title={`Final Target: ${name}`}
      />
      <div className="text-[10px] uppercase font-bold text-emerald-400 mb-0.5 tracking-wider">
        Target Quota
      </div>
      <div className="text-xs font-bold text-white capitalize whitespace-nowrap mb-1">
        {name}
      </div>
      <div
        className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800"
        style={{ color }}
      >
        {nodeData.rate.toFixed(1)}/m
      </div>
    </div>
  );
};

export default memo(OutputNode);
