"use client";
import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface SplitterNodeData extends Record<string, unknown> {
  item: string;
  totalIn: number;
  outputs: { to: string; rate: number }[];
  beltTier: number;
}

const SplitterNode = ({ data }: NodeProps<any>) => {
  const nodeData = data as SplitterNodeData;
  const itemName = (nodeData.item || "").replace(/_/g, " ");

  return (
    <div className="bg-slate-900 border-2 border-amber-500/80 rounded-lg p-2 text-white shadow-xl shadow-amber-950/20 min-w-[130px] flex flex-col justify-between transition-transform hover:scale-105">
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-amber-400 border-2 border-slate-900 !-left-1.5" 
      />

      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1 mb-1">
        <span className="text-amber-400 font-bold text-xs">⑂</span>
        <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Splitter</span>
        <span className="text-[9px] text-slate-400 font-mono ml-auto">Mk.{nodeData.beltTier || 1}</span>
      </div>

      <div className="text-[10px] text-slate-300 font-mono capitalize truncate mb-1" title={itemName}>
        {itemName}
      </div>

      <div className="bg-slate-950/80 rounded px-1.5 py-1 text-[9px] font-mono border border-slate-800 space-y-0.5">
        <div className="flex justify-between text-amber-400 font-semibold">
          <span>IN:</span>
          <span>{nodeData.totalIn?.toFixed(0)}/m</span>
        </div>
        <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-0.5">
          <span>OUT ({nodeData.outputs?.length || 2}×):</span>
          <span>{((nodeData.totalIn || 0) / (nodeData.outputs?.length || 2)).toFixed(0)}/m ea</span>
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-amber-400 border-2 border-slate-900 !-right-1.5" 
      />
    </div>
  );
};

export default memo(SplitterNode);
