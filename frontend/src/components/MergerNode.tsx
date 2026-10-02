"use client";
import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getItemColor, formatItemName } from "@/lib/colors";

export interface MergerNodeData extends Record<string, unknown> {
  item: string;
  totalOut: number;
  inputs: { from: string; rate: number }[];
  beltTier: number;
}

const MergerNode = ({ data }: NodeProps) => {
  const nodeData = data as MergerNodeData;
  const itemColor = getItemColor(nodeData.item);
  const itemName = formatItemName(nodeData.item);
  const inputs = nodeData.inputs || [];
  const inputCount = Math.max(inputs.length, 1);

  return (
    <div
      className="relative z-20 bg-slate-900 border-2 rounded-xl p-2.5 text-white shadow-2xl w-[155px] flex flex-col justify-between transition-all hover:scale-105 select-none"
      style={{ borderColor: itemColor }}
    >
      {/* Distinct Target Handles on Left for each incoming branch */}
      {inputs.map((inp, idx) => {
        const topPercent =
          inputCount === 1
            ? 50
            : 28 + (idx / (inputCount - 1)) * 44;
        return (
          <Handle
            key={idx}
            id={`in-${idx}`}
            type="target"
            position={Position.Left}
            style={{
              top: `${topPercent}%`,
              backgroundColor: itemColor,
              borderColor: "#0f172a",
            }}
            className="w-3.5 h-3.5 border-2 !-left-2 transition-transform hover:scale-125"
            title={`Branch In ${idx + 1}: ${inp.rate.toFixed(1)}/m`}
          />
        );
      })}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-xs" style={{ color: itemColor }}>
            ⑃
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200">
            Merger
          </span>
        </div>
        <span className="text-[9px] text-slate-400 font-mono bg-slate-800 px-1 py-0.5 rounded">
          Mk.{nodeData.beltTier || 1}
        </span>
      </div>

      {/* Item Name */}
      <div
        className="text-[11px] font-medium truncate mb-2"
        style={{ color: itemColor }}
        title={itemName}
      >
        {itemName}
      </div>

      {/* Flow Rates Table */}
      <div className="bg-slate-950/80 rounded-lg p-2 text-[9.5px] font-mono border border-slate-800 space-y-1">
        <div className="space-y-0.5">
          <div className="text-[8.5px] text-slate-400 uppercase tracking-wider">
            IN ({inputCount}&times;):
          </div>
          {inputs.map((inp, idx) => (
            <div key={idx} className="flex justify-between text-slate-300 text-[9px]">
              <span className="text-slate-400">Port {idx + 1}:</span>
              <span className="text-slate-200 font-medium">
                {inp.rate.toFixed(1)}/m
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center text-slate-300 border-t border-slate-800/80 pt-1">
          <span className="text-slate-400 font-semibold">OUT:</span>
          <span className="font-bold text-emerald-400">
            {nodeData.totalOut?.toFixed(1)}/m
          </span>
        </div>
      </div>

      {/* Primary Output Handle on Right */}
      <Handle
        id="output"
        type="source"
        position={Position.Right}
        style={{ backgroundColor: itemColor, borderColor: "#0f172a" }}
        className="w-3.5 h-3.5 border-2 !-right-2"
        title={`Merger Output: ${itemName} (${nodeData.totalOut?.toFixed(1)}/m)`}
      />
    </div>
  );
};

export default memo(MergerNode);
