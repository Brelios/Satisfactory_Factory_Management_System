"use client";
import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface ResourceNodeData extends Record<string, unknown> {
  label: string;
  rate: number;
  color: string;
}

const ResourceNode = ({ data }: NodeProps<any>) => {
  const nodeData = data as ResourceNodeData;

  return (
    <div 
      className="bg-slate-800 border-2 rounded-full w-24 h-24 flex flex-col items-center justify-center text-center shadow-lg transition-transform hover:scale-[1.05]"
      style={{ borderColor: nodeData.color || "#f59e0b" }}
    >
      <div className="text-xs font-bold text-slate-200 px-1 leading-tight mb-1 capitalize">
        {nodeData.label.replace(/_/g, ' ')}
      </div>
      <div className="text-xs text-amber-500 font-mono">
        {nodeData.rate.toFixed(1)}/m
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-amber-500" />
    </div>
  );
};

export default memo(ResourceNode);
