"use client";
import React, { useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
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
    if (!result || !result.steps.length) return { initialNodes: [], initialEdges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // 1. Calculate topological depth (column) for each step
    const stepDepths: Record<string, number> = {};
    for (const step of result.steps) {
      stepDepths[step.step_id] = 0;
    }

    // Relaxation loop to find longest path from raw inputs
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 50) {
      changed = false;
      iterations++;
      for (const conn of result.connections) {
        if (conn.from_step in stepDepths && conn.to_step in stepDepths) {
          const fromDepth = stepDepths[conn.from_step];
          if (fromDepth >= stepDepths[conn.to_step]) {
            stepDepths[conn.to_step] = fromDepth + 1;
            changed = true;
          }
        }
      }
    }

    // 2. Group steps by column (depth)
    const columns: Record<number, string[]> = {};
    for (const step of result.steps) {
      const depth = stepDepths[step.step_id] || 0;
      if (!columns[depth]) columns[depth] = [];
      columns[depth].push(step.step_id);
    }

    const sortedColKeys = Object.keys(columns).map(Number).sort((a, b) => a - b);
    const maxDepth = sortedColKeys.length ? Math.max(...sortedColKeys) : 0;

    // 3. Hierarchical barycentric row sorting to align connected steps in straight horizontal lines
    // Track row index (0, 1, 2...) for each step
    const stepRowIndex: Record<string, number> = {};

    sortedColKeys.forEach((colIdx) => {
      const stepIdsInCol = columns[colIdx];

      if (colIdx === 0) {
        // First column: stable sort by recipe name
        stepIdsInCol.sort((a, b) => a.localeCompare(b));
      } else {
        // Subsequent columns: sort by average row index of incoming suppliers
        stepIdsInCol.sort((stepA, stepB) => {
          const getAvgSupplierRow = (stepId: string) => {
            const incoming = result.connections.filter(c => c.to_step === stepId);
            if (!incoming.length) return 999;
            const supplierRows = incoming
              .map(c => stepRowIndex[c.from_step])
              .filter(r => r !== undefined);
            if (!supplierRows.length) return 999;
            return supplierRows.reduce((sum, r) => sum + r, 0) / supplierRows.length;
          };

          return getAvgSupplierRow(stepA) - getAvgSupplierRow(stepB);
        });
      }

      stepIdsInCol.forEach((stepId, rowIdx) => {
        stepRowIndex[stepId] = rowIdx;
      });
    });

    // Dimensions & Spacing
    const COL_SPACING = 560; // Wide horizontal runway between columns
    const ROW_SPACING = 270; // Clear vertical clearance between stacked rows
    const NODE_OFFSET_X = 360; // Offset after resource nodes (col 0)

    // Find the max rows across all columns for vertical centering
    const maxRowsInAnyCol = Math.max(
      ...Object.values(columns).map(c => c.length),
      Object.keys(result.resource_usage).length,
      Object.keys(result.target_outputs).length,
      1
    );

    // 4. Position Machine Nodes
    const stepLookup = new Map(result.steps.map(s => [s.step_id, s]));

    sortedColKeys.forEach((colIdx) => {
      const stepIdsInCol = columns[colIdx];
      const colHeight = stepIdsInCol.length;
      // Vertically center column relative to the diagram height
      const yOffset = ((maxRowsInAnyCol - colHeight) * ROW_SPACING) / 2;

      stepIdsInCol.forEach((stepId, rowIdx) => {
        const step = stepLookup.get(stepId);
        if (!step) return;

        const x = NODE_OFFSET_X + colIdx * COL_SPACING;
        const y = yOffset + rowIdx * ROW_SPACING;

        // Color coding by material family
        let chainColor = "#4A90D9";
        const idLower = stepId.toLowerCase();
        if (idLower.includes("steel") || idLower.includes("pipe") || idLower.includes("beam")) {
          chainColor = "#94a3b8"; // Steel slate
        } else if (idLower.includes("copper") || idLower.includes("wire") || idLower.includes("cable")) {
          chainColor = "#f97316"; // Copper orange
        } else if (idLower.includes("iron") || idLower.includes("plate") || idLower.includes("rod") || idLower.includes("screw") || idLower.includes("frame")) {
          chainColor = "#f59e0b"; // Iron amber
        }

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
            chainColor,
            recipeId: step.recipe_id,
            normalMachineCount: step.normal_machine_count,
            underclockedMachineCount: step.underclocked_machine_count,
            underclockClockSpeed: step.underclock_clock_speed,
          },
        });
      });
    });

    // 5. Build Smoothstep Conduit Edges between Machine Steps
    result.connections.forEach((conn, idx) => {
      const isMultiBelt = conn.belt_count > 1;
      
      // Clean, compact label: Line 1 = Item & Belt, Line 2 = Machine Feed
      const itemName = conn.item.replace(/_/g, " ");
      const beltInfo = isMultiBelt
        ? `${conn.belt_count}× Mk.${conn.belt_tier} (${conn.rate_per_belt.toFixed(0)}/m ea)`
        : `Mk.${conn.belt_tier} (${conn.rate.toFixed(0)}/m)`;
      
      const feedShort = conn.feed_description
        ? conn.feed_description.replace("Feeds ", "Feeds: ").replace(" operating normally", "").replace(" underclocked", "")
        : "";

      const labelText = feedShort
        ? `${itemName} • ${beltInfo}\n${feedShort}`
        : `${itemName} • ${beltInfo}`;

      // Pick conduit color matching the material
      let edgeColor = "#38bdf8";
      const itemLower = conn.item.toLowerCase();
      if (itemLower.includes("steel")) edgeColor = "#cbd5e1";
      else if (itemLower.includes("copper") || itemLower.includes("wire")) edgeColor = "#fb923c";
      else if (itemLower.includes("iron") || itemLower.includes("screw") || itemLower.includes("plate") || itemLower.includes("rod")) edgeColor = "#fbbf24";

      edges.push({
        id: `e-${conn.from_step}-${conn.to_step}-${idx}`,
        source: conn.from_step,
        target: conn.to_step,
        type: "smoothstep",
        animated: true,
        label: labelText,
        labelStyle: { 
          fill: "#f8fafc", 
          fontSize: 9.5, 
          fontFamily: "monospace", 
          fontWeight: isMultiBelt ? 600 : 500 
        },
        labelBgStyle: { 
          fill: "#0f172a", 
          stroke: isMultiBelt ? "#38bdf8" : edgeColor, 
          strokeWidth: 1.5,
          rx: 6,
          ry: 6,
        },
        labelBgPadding: [8, 5],
        style: { 
          strokeWidth: isMultiBelt ? 2.5 + conn.belt_tier * 0.4 : 1.8 + conn.belt_tier * 0.3, 
          stroke: edgeColor,
          strokeDasharray: isMultiBelt ? "8,4" : undefined
        },
        markerEnd: { 
          type: MarkerType.ArrowClosed, 
          color: edgeColor,
          width: 14,
          height: 14
        },
      });
    });

    // 6. Resource Input Nodes (Column 0, left)
    const resourceKeys = Object.keys(result.resource_usage);
    const resYOffset = ((maxRowsInAnyCol - resourceKeys.length) * ROW_SPACING) / 2;

    resourceKeys.forEach((item, rIdx) => {
      const rate = result.resource_usage[item];
      const id = `res-${item}`;
      const y = resYOffset + rIdx * ROW_SPACING;

      nodes.push({
        id,
        type: "resourceNode",
        position: { x: 40, y: y + 20 },
        data: { label: item, rate, color: "#f59e0b" },
      });
      
      // Smoothstep connections from resource node to consuming steps
      result.steps.forEach(step => {
        if (step.input_rates[item]) {
          const consumeRate = step.input_rates[item];
          edges.push({
            id: `e-${id}-${step.step_id}`,
            source: id,
            target: step.step_id,
            type: "smoothstep",
            animated: true,
            label: `${item.replace(/_/g, " ")} • ${consumeRate.toFixed(0)}/m`,
            labelStyle: { fill: "#f8fafc", fontSize: 9.5, fontFamily: "monospace" },
            labelBgStyle: { fill: "#0f172a", stroke: "#f59e0b", strokeWidth: 1.5, rx: 6, ry: 6 },
            labelBgPadding: [8, 5],
            style: { strokeWidth: 2, stroke: "#f59e0b", strokeDasharray: "6,3" },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
          });
        }
      });
    });

    // 7. Output Product Nodes (Rightmost Column)
    const outputKeys = Object.keys(result.target_outputs);
    const outX = NODE_OFFSET_X + (maxDepth + 1) * COL_SPACING + 40;
    const outYOffset = ((maxRowsInAnyCol - outputKeys.length) * ROW_SPACING) / 2;

    outputKeys.forEach((item, oIdx) => {
      const rate = result.target_outputs[item];
      const id = `out-${item}`;
      const y = outYOffset + oIdx * ROW_SPACING;

      nodes.push({
        id,
        type: "outputNode",
        position: { x: outX, y: y + 20 },
        data: { label: item, rate },
      });
      
      // Connect producing steps to output node
      result.steps.forEach(step => {
        if (step.output_rates[item]) {
          const prodRate = step.output_rates[item];
          edges.push({
            id: `e-${step.step_id}-${id}`,
            source: step.step_id,
            target: id,
            type: "smoothstep",
            animated: true,
            label: `✓ ${item.replace(/_/g, " ")} • ${prodRate.toFixed(0)}/m`,
            labelStyle: { fill: "#ecfdf5", fontSize: 9.5, fontFamily: "monospace", fontWeight: 600 },
            labelBgStyle: { fill: "#0f172a", stroke: "#10b981", strokeWidth: 1.5, rx: 6, ry: 6 },
            labelBgPadding: [8, 5],
            style: { strokeWidth: 2.2, stroke: "#10b981" },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
          });
        }
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [result]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border border-slate-700 rounded-lg text-sky-400">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div>Calculating optimal blueprint...</div>
      </div>
    );
  }

  if (!result || !result.steps.length) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border border-slate-700 rounded-lg text-slate-500">
        <div className="text-4xl mb-2">🏭</div>
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
        minZoom={0.15}
        maxZoom={2.5}
        className="blueprint-grid"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#334155" />
        <Controls className="!bg-slate-800 !border-slate-700 !rounded-lg overflow-hidden shadow-xl" />
        <MiniMap 
          nodeColor="#3b82f6" 
          maskColor="rgba(15, 23, 42, 0.75)" 
          className="!bg-slate-900 !border !border-slate-700 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}
