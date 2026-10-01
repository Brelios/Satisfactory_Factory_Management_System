"use client";
import React, { useMemo, useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  MarkerType
} from "@xyflow/react";
import type { SolveResponse, GameItem } from "@/lib/types";
import MachineNode from "./MachineNode";
import ResourceNode from "./ResourceNode";
import OutputNode from "./OutputNode";

interface BlueprintCanvasProps {
  result: SolveResponse | null;
  isLoading: boolean;
  items: GameItem[];
}

const nodeTypes = {
  machineNode: MachineNode as any,
  resourceNode: ResourceNode as any,
  outputNode: OutputNode as any,
};

export default function BlueprintCanvas({ result, isLoading, items }: BlueprintCanvasProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!result) return { initialNodes: [], initialEdges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const stepDepths: Record<string, number> = {};

    // Calculate topological depths
    let changed = true;
    while (changed) {
      changed = false;
      for (const conn of result.connections) {
        const fromDepth = stepDepths[conn.from_step] || 0;
        const toDepth = stepDepths[conn.to_step] || 0;
        if (fromDepth >= toDepth) {
          stepDepths[conn.to_step] = fromDepth + 1;
          changed = true;
        }
      }
    }

    const maxDepth = Math.max(0, ...Object.values(stepDepths));
    const columnCounts: Record<number, number> = {};
    const stepPositions: Record<string, { x: number, y: number }> = {};

    // Machine Nodes
    result.steps.forEach((step) => {
      const depth = stepDepths[step.step_id] || 0;
      const col = depth + 1; // leave col 0 for resources
      const row = columnCounts[col] || 0;
      columnCounts[col] = row + 1;

      const x = col * 350;
      const y = row * 220;
      stepPositions[step.step_id] = { x, y };

      nodes.push({
        id: step.step_id,
        type: "machineNode",
        position: { x, y },
        data: {
          label: step.recipe_name,
          machine: step.machine,
          machineCount: step.machine_count,
          clockSpeed: step.clock_speed,
          inputRates: step.input_rates,
          outputRates: step.output_rates,
          powerMw: step.power_mw,
          chainColor: "#f59e0b", // default color
          recipeId: step.recipe_id,
        },
      });
    });

    // Edges
    result.connections.forEach((conn, idx) => {
      edges.push({
        id: `e-${conn.from_step}-${conn.to_step}-${idx}`,
        source: conn.from_step,
        target: conn.to_step,
        animated: true,
        label: `${conn.item.replace(/_/g, " ")}\n${conn.rate.toFixed(1)}/m Mk.${conn.belt_tier}`,
        labelStyle: { fill: "#1e293b", color: "white", fontSize: 10, fontFamily: "monospace" },
        labelBgStyle: { fill: "#cbd5e1", color: "#cbd5e1" },
        style: { strokeWidth: 1 + conn.belt_tier * 0.5, stroke: "#4A90D9" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#4A90D9" },
      });
    });

    // Resource Nodes (col 0)
    let resRow = 0;
    Object.entries(result.resource_usage).forEach(([item, rate]) => {
      const id = `res-${item}`;
      nodes.push({
        id,
        type: "resourceNode",
        position: { x: 0, y: resRow * 150 },
        data: { label: item, rate, color: "#f59e0b" },
      });
      
      // Connect to steps that consume this resource
      result.steps.forEach(step => {
        if (step.input_rates[item]) {
          edges.push({
            id: `e-${id}-${step.step_id}`,
            source: id,
            target: step.step_id,
            animated: true,
            label: `${item.replace(/_/g, " ")}\n${step.input_rates[item].toFixed(1)}/m`,
            labelStyle: { fill: "#1e293b", fontSize: 10, fontFamily: "monospace" },
            labelBgStyle: { fill: "#cbd5e1" },
            style: { strokeWidth: 2, stroke: "#f59e0b" },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
          });
        }
      });
      resRow++;
    });

    // Output Nodes (col maxDepth + 2)
    let outRow = 0;
    Object.entries(result.target_outputs).forEach(([item, rate]) => {
      const id = `out-${item}`;
      nodes.push({
        id,
        type: "outputNode",
        position: { x: (maxDepth + 2) * 350, y: outRow * 150 },
        data: { label: item, rate },
      });
      
      // Connect from steps that produce this output
      result.steps.forEach(step => {
        if (step.output_rates[item]) {
          // Verify if it's consumed entirely by other steps. Simple heuristic: just connect if output is in target_outputs.
          // For a precise map, we'd calculate unconsumed output, but this works visually.
          edges.push({
            id: `e-${step.step_id}-${id}`,
            source: step.step_id,
            target: id,
            animated: true,
            label: `${item.replace(/_/g, " ")}\n${step.output_rates[item].toFixed(1)}/m`,
            labelStyle: { fill: "#1e293b", fontSize: 10, fontFamily: "monospace" },
            labelBgStyle: { fill: "#cbd5e1" },
            style: { strokeWidth: 2, stroke: "#10b981" },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
          });
        }
      });
      outRow++;
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [result]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border border-slate-700 rounded-lg">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-slate-400">Optimizing blueprint...</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border border-slate-700 rounded-lg text-slate-500">
        <div className="text-4xl mb-4">🏭</div>
        <div className="text-lg">Configure resources and click Solve</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden relative">
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        fitView
        className="blueprint-grid"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
