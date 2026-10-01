"use client";
import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface OutputNodeData extends Record<string, unknown> {
  label: string;
  rate: number;
}

const OutputNode = ({ data }: NodeProps<any>) => {
  const nodeData = data as OutputNodeData;

  return (
    <div className="bg-emerald-900 border-2 border-emerald-500 rounded-full px-4 py-3 flex flex-col items-center justify-center text-center shadow-lg transition-transform hover:scale-[1.05]">
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-emerald-400" />
      <div className="text-sm font-bold text-white capitalize whitespace-nowrap">
        {nodeData.label.replace(/_/g, ' ')}
      </div>
      <div className="text-xs text-emerald-300 font-mono mt-1">
        {nodeData.rate.toFixed(1)}/m
      </div>
    </div>
  );
};

export default memo(OutputNode);
