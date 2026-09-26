"use client";

import React from "react";
import { SolveResponse } from "@/lib/types";
import { Factory, Zap, Package, Layers } from "lucide-react";

interface ShoppingListProps {
  result: SolveResponse | null;
}

export function ShoppingList({ result }: ShoppingListProps) {
  if (!result) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center text-slate-400">
        <Package className="mx-auto mb-2 opacity-50" size={32} />
        <p>No results yet.</p>
      </div>
    );
  }

  // Get belt tiers from connections
  const beltTiers = result.connections.reduce((acc, conn) => {
    const tier = \`Mk.\${conn.belt_tier}\`;
    acc[tier] = (acc[tier] || 0) + conn.rate;
    return acc;
  }, {} as Record<string, number>);

  const getBuildingColor = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("smelter") || lower.includes("foundry")) return "bg-amber-600/20 text-amber-500";
    if (lower.includes("constructor")) return "bg-sky-500/20 text-sky-400";
    if (lower.includes("assembler") || lower.includes("manufacturer")) return "bg-purple-500/20 text-purple-400";
    if (lower.includes("refinery") || lower.includes("blender")) return "bg-orange-500/20 text-orange-400";
    return "bg-slate-600/20 text-slate-300";
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex items-center space-x-4">
          <div className="p-3 bg-sky-500/20 text-sky-400 rounded-lg">
            <Factory size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Machines</p>
            <p className="text-2xl font-bold text-white">{result.total_machines}</p>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex items-center space-x-4">
          <div className="p-3 bg-yellow-500/20 text-yellow-500 rounded-lg">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400">Power Consumption</p>
            <p className="text-2xl font-bold text-white">{result.total_power_mw.toFixed(1)} MW</p>
          </div>
        </div>
      </div>

      {/* Target Outputs */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center">
            <Package size={16} className="mr-2" />
            Outputs Generated
          </h3>
        </div>
        <div className="p-4 grid gap-3">
          {Object.entries(result.target_outputs).map(([item, rate]) => (
            <div key={item} className="flex justify-between items-center bg-slate-900/50 p-2 rounded">
              <span className="text-slate-300">{item}</span>
              <span className="font-mono text-emerald-400 font-medium">{rate.toFixed(1)} /min</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resource Usage */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center">
            <Layers size={16} className="mr-2" />
            Resource Usage
          </h3>
        </div>
        <div className="p-4 grid gap-3">
          {Object.entries(result.resource_usage).map(([item, rate]) => (
            <div key={item} className="flex justify-between items-center bg-slate-900/50 p-2 rounded">
              <span className="text-slate-300">{item}</span>
              <span className="font-mono text-orange-400 font-medium">{rate.toFixed(1)} /min</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shopping List */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center">
            <Factory size={16} className="mr-2" />
            Buildings Required
          </h3>
        </div>
        <div className="p-4 grid gap-3">
          {Object.entries(result.shopping_list).map(([building, count]) => (
            <div key={building} className="flex justify-between items-center bg-slate-900/50 p-2 rounded">
              <div className="flex items-center space-x-2">
                <span className={\`text-xs px-2 py-0.5 rounded-full \${getBuildingColor(building)}\`}>
                  {building}
                </span>
              </div>
              <span className="font-mono text-white font-medium">x{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Belts Required */}
      {Object.keys(beltTiers).length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center">
              <Layers size={16} className="mr-2" />
              Belt Logistics (Max Rate)
            </h3>
          </div>
          <div className="p-4 grid gap-3">
            {Object.entries(beltTiers).map(([tier, rate]) => (
              <div key={tier} className="flex justify-between items-center bg-slate-900/50 p-2 rounded">
                <span className="text-slate-300">Belt {tier}</span>
                <span className="font-mono text-sky-400 font-medium">{rate.toFixed(1)} /min total capacity</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
