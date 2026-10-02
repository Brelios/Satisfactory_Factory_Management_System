"use client";
import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getItemColor, formatItemName } from "@/lib/colors";

export interface ResourceNodeData extends Record<string, unknown> {
  label: string;
  rate: number;
  color?: string;
}

const ResourceNode = ({ data }: NodeProps) => {
  const nodeData = data as ResourceNodeData;
  const color = getItemColor(nodeData.label) || nodeData.color || "#f59e0b";
  const name = formatItemName(nodeData.label);

  return (
    <div
      className="relative z-20 bg-slate-900 border-2 rounded-2xl w-28 h-28 flex flex-col items-center justify-center text-center shadow-xl transition-all hover:scale-105 p-2 select-none"
      style={{ borderColor: color }}
    >
      <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 tracking-wider">
        Miner
      </div>
      <div
        className="text-xs font-bold text-white px-1 leading-tight mb-1 truncate max-w-full"
        title={name}
      >
        {name}
      </div>
      <div
        className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950/70 border border-slate-800"
        style={{ color }}
      >
        {nodeData.rate.toFixed(1)}/m
      </div>
      <Handle
        id="output"
        type="source"
        position={Position.Right}
        style={{ backgroundColor: color, borderColor: "#0f172a" }}
        className="w-3.5 h-3.5 border-2 !-right-2"
        title={`Miner Output: ${name}`}
      />
    </div>
  );
};

export default memo(ResourceNode);
