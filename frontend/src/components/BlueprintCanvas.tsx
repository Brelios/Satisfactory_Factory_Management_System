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
import SplitterNode from "./SplitterNode";
import MergerNode from "./MergerNode";

interface BlueprintCanvasProps {
  result: SolveResponse | null;
  isLoading: boolean;
  items: GameItem[];
}

const nodeTypes = {
  machineNode: MachineNode as any,
  resourceNode: ResourceNode as any,
  outputNode: OutputNode as any,
  splitterNode: SplitterNode as any,
  mergerNode: MergerNode as any,
};

export default function BlueprintCanvas({ result, isLoading, items }: BlueprintCanvasProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!result || !result.steps.length) return { initialNodes: [], initialEdges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Helper: color code by material family
    const getMaterialColor = (itemId: string): string => {
      const lid = itemId.toLowerCase();
      if (lid.includes("steel") || lid.includes("pipe") || lid.includes("beam")) return "#94a3b8"; // Steel slate
      if (lid.includes("copper") || lid.includes("wire") || lid.includes("cable")) return "#fb923c"; // Copper orange
      if (lid.includes("iron") || lid.includes("plate") || lid.includes("rod") || lid.includes("screw") || lid.includes("frame")) return "#fbbf24"; // Iron amber
      return "#38bdf8"; // Sky default
    };

    // 1. Calculate topological depth (column index) for each machine step
    const stepDepths: Record<string, number> = {};
    for (const step of result.steps) {
      stepDepths[step.step_id] = 0;
    }

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

    // 3. Hierarchical barycentric row sorting to align connected machines in straight horizontal lines
    const stepRowIndex: Record<string, number> = {};
    sortedColKeys.forEach((colIdx) => {
      const stepIdsInCol = columns[colIdx];
      if (colIdx === 0) {
        stepIdsInCol.sort((a, b) => a.localeCompare(b));
      } else {
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

    // Spacing constants designed to guarantee obstacle-free corridors
    const COL_SPACING = 680; // Machine-to-machine horizontal pitch
    const ROW_SPACING = 300; // Machine-to-machine vertical pitch
    const NODE_OFFSET_X = 400; // Offset after resource miners (col 0)
    const SPLITTER_CORRIDOR_OFFSET = 330; // Position of splitters in the corridor between columns

    const maxRowsInAnyCol = Math.max(
      ...Object.values(columns).map(c => c.length),
      Object.keys(result.resource_usage).length,
      Object.keys(result.target_outputs).length,
      1
    );

    // 4. Place Machine Nodes
    const stepLookup = new Map(result.steps.map(s => [s.step_id, s]));
    const machinePositions: Record<string, { x: number; y: number }> = {};

    sortedColKeys.forEach((colIdx) => {
      const stepIdsInCol = columns[colIdx];
      const colHeight = stepIdsInCol.length;
      const yOffset = ((maxRowsInAnyCol - colHeight) * ROW_SPACING) / 2;

      stepIdsInCol.forEach((stepId, rowIdx) => {
        const step = stepLookup.get(stepId);
        if (!step) return;

        const x = NODE_OFFSET_X + colIdx * COL_SPACING;
        const y = yOffset + rowIdx * ROW_SPACING;
        machinePositions[step.step_id] = { x, y };

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
            chainColor: getMaterialColor(step.step_id),
            recipeId: step.recipe_id,
            normalMachineCount: step.normal_machine_count,
            underclockedMachineCount: step.underclocked_machine_count,
            underclockClockSpeed: step.underclock_clock_speed,
          },
        });
      });
    });

    // 5. Build Conveyor Splitters & Straight Corridor Edges between Machine Steps
    // Group outgoing connections by supplier step and item
    const outgoingGroups: Record<string, typeof result.connections> = {};
    result.connections.forEach(conn => {
      const key = `${conn.from_step}__${conn.item}`;
      if (!outgoingGroups[key]) outgoingGroups[key] = [];
      outgoingGroups[key].push(conn);
    });

    Object.entries(outgoingGroups).forEach(([key, conns]) => {
      const [fromStepId, itemId] = key.split("__");
      const fromPos = machinePositions[fromStepId];
      if (!fromPos) return;

      const edgeColor = getMaterialColor(itemId);
      const itemName = itemId.replace(/_/g, " ");

      if (conns.length > 1) {
        // MULTI-BRANCH FEED -> Insert Conveyor Splitter in the corridor!
        const totalRate = conns.reduce((sum, c) => sum + c.rate, 0);
        const maxTier = Math.max(...conns.map(c => c.belt_tier), 1);
        const splitterId = `splitter-${fromStepId}-${itemId}`;

        // Compute average Y of the destination machines to place splitter centrally
        const destYs = conns
          .map(c => machinePositions[c.to_step]?.y)
          .filter(y => y !== undefined) as number[];
        const avgDestY = destYs.length ? destYs.reduce((a, b) => a + b, 0) / destYs.length : fromPos.y;
        
        // Splitter position: in the clear corridor between this column and the next
        const splitterX = fromPos.x + SPLITTER_CORRIDOR_OFFSET;
        const splitterY = avgDestY + 25; // align near middle

        nodes.push({
          id: splitterId,
          type: "splitterNode",
          position: { x: splitterX, y: splitterY },
          data: {
            item: itemId,
            totalIn: totalRate,
            outputs: conns.map(c => ({ to: c.to_step, rate: c.rate })),
            beltTier: maxTier,
          },
        });

        // Machine -> Splitter (clean horizontal line into splitter)
        edges.push({
          id: `e-${fromStepId}-${splitterId}`,
          source: fromStepId,
          target: splitterId,
          type: "smoothstep",
          animated: true,
          label: `${itemName} • ${totalRate.toFixed(0)}/m (Mk.${maxTier})`,
          labelStyle: { fill: "#f8fafc", fontSize: 9.5, fontFamily: "monospace", fontWeight: 600 },
          labelBgStyle: { fill: "#0f172a", stroke: edgeColor, strokeWidth: 1.5, rx: 6, ry: 6 },
          labelBgPadding: [6, 4],
          style: { strokeWidth: 2.2, stroke: edgeColor },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
        });

        // Splitter -> each Destination Machine
        conns.forEach((conn, cIdx) => {
          const feedDesc = conn.feed_description
            ? conn.feed_description.replace("Feeds ", "Feeds: ").replace(" operating normally", "").replace(" underclocked", "")
            : `${conn.rate.toFixed(0)}/m`;

          edges.push({
            id: `e-${splitterId}-${conn.to_step}-${cIdx}`,
            source: splitterId,
            target: conn.to_step,
            type: "smoothstep",
            animated: true,
            label: `↳ ${conn.rate.toFixed(0)}/m (${feedDesc})`,
            labelStyle: { fill: "#fef08a", fontSize: 9, fontFamily: "monospace", fontWeight: 500 },
            labelBgStyle: { fill: "#0f172a", stroke: edgeColor, strokeWidth: 1.2, rx: 5, ry: 5 },
            labelBgPadding: [6, 3],
            style: { strokeWidth: 1.8, stroke: edgeColor },
            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
          });
        });

      } else {
        // SINGLE BRANCH FEED -> Direct smoothstep conduit
        const conn = conns[0];
        const isMultiBelt = conn.belt_count > 1;
        const beltInfo = isMultiBelt
          ? `${conn.belt_count}× Mk.${conn.belt_tier} (${conn.rate_per_belt.toFixed(0)}/m ea)`
          : `Mk.${conn.belt_tier} (${conn.rate.toFixed(0)}/m)`;
        
        const feedShort = conn.feed_description
          ? conn.feed_description.replace("Feeds ", "Feeds: ").replace(" operating normally", "").replace(" underclocked", "")
          : "";

        const labelText = feedShort
          ? `${itemName} • ${beltInfo}\n${feedShort}`
          : `${itemName} • ${beltInfo}`;

        edges.push({
          id: `e-${conn.from_step}-${conn.to_step}`,
          source: conn.from_step,
          target: conn.to_step,
          type: "smoothstep",
          animated: true,
          label: labelText,
          labelStyle: { fill: "#f8fafc", fontSize: 9.5, fontFamily: "monospace", fontWeight: 500 },
          labelBgStyle: { fill: "#0f172a", stroke: edgeColor, strokeWidth: 1.5, rx: 6, ry: 6 },
          labelBgPadding: [8, 5],
          style: { 
            strokeWidth: isMultiBelt ? 2.5 + conn.belt_tier * 0.3 : 1.8 + conn.belt_tier * 0.2, 
            stroke: edgeColor,
            strokeDasharray: isMultiBelt ? "8,4" : undefined 
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
        });
      }
    });

    // 6. Resource Input Miners & Splitters (Column 0, left)
    const resourceKeys = Object.keys(result.resource_usage);
    const resYOffset = ((maxRowsInAnyCol - resourceKeys.length) * ROW_SPACING) / 2;

    resourceKeys.forEach((item, rIdx) => {
      const rate = result.resource_usage[item];
      const resId = `res-${item}`;
      const y = resYOffset + rIdx * ROW_SPACING;

      nodes.push({
        id: resId,
        type: "resourceNode",
        position: { x: 40, y: y + 25 },
        data: { label: item, rate, color: "#f59e0b" },
      });

      // Find all machine steps consuming this resource
      const consumingSteps = result.steps.filter(step => step.input_rates[item]);

      if (consumingSteps.length > 1) {
        // Resource feeds multiple lines -> insert a Conveyor Splitter!
        const splitterId = `res-splitter-${item}`;
        const destYs = consumingSteps
          .map(s => machinePositions[s.step_id]?.y)
          .filter(y => y !== undefined) as number[];
        const avgDestY = destYs.length ? destYs.reduce((a, b) => a + b, 0) / destYs.length : y;

        nodes.push({
          id: splitterId,
          type: "splitterNode",
          position: { x: 230, y: avgDestY + 25 },
          data: {
            item,
            totalIn: rate,
            outputs: consumingSteps.map(s => ({ to: s.step_id, rate: s.input_rates[item] })),
            beltTier: 3,
          },
        });

        // Miner -> Splitter
        edges.push({
          id: `e-${resId}-${splitterId}`,
          source: resId,
          target: splitterId,
          type: "smoothstep",
          animated: true,
          label: `${item.replace(/_/g, " ")} • ${rate.toFixed(0)}/m`,
          labelStyle: { fill: "#f8fafc", fontSize: 9.5, fontFamily: "monospace", fontWeight: 600 },
          labelBgStyle: { fill: "#0f172a", stroke: "#f59e0b", strokeWidth: 1.5, rx: 6, ry: 6 },
          labelBgPadding: [6, 4],
          style: { strokeWidth: 2.2, stroke: "#f59e0b", strokeDasharray: "6,3" },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
        });

        // Splitter -> each Consuming Step
        consumingSteps.forEach((step, sIdx) => {
          const consumeRate = step.input_rates[item];
          edges.push({
            id: `e-${splitterId}-${step.step_id}-${sIdx}`,
            source: splitterId,
            target: step.step_id,
            type: "smoothstep",
            animated: true,
            label: `↳ ${consumeRate.toFixed(0)}/m`,
            labelStyle: { fill: "#fef08a", fontSize: 9, fontFamily: "monospace" },
            labelBgStyle: { fill: "#0f172a", stroke: "#f59e0b", strokeWidth: 1.2, rx: 5, ry: 5 },
            labelBgPadding: [6, 3],
            style: { strokeWidth: 1.8, stroke: "#f59e0b" },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
          });
        });
      } else if (consumingSteps.length === 1) {
        const step = consumingSteps[0];
        const consumeRate = step.input_rates[item];
        edges.push({
          id: `e-${resId}-${step.step_id}`,
          source: resId,
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

    // 7. Output Product Nodes (Rightmost Column)
    const outputKeys = Object.keys(result.target_outputs);
    const maxColIdx = sortedColKeys.length ? Math.max(...sortedColKeys) : 0;
    const outX = NODE_OFFSET_X + (maxColIdx + 1) * COL_SPACING + 40;
    const outYOffset = ((maxRowsInAnyCol - outputKeys.length) * ROW_SPACING) / 2;

    outputKeys.forEach((item, oIdx) => {
      const rate = result.target_outputs[item];
      const id = `out-${item}`;
      const y = outYOffset + oIdx * ROW_SPACING;

      nodes.push({
        id,
        type: "outputNode",
        position: { x: outX, y: y + 25 },
        data: { label: item, rate },
      });

      // Connect producing machine steps directly to output node
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
          nodeColor={(n) => {
            if (n.type === "splitterNode") return "#f59e0b";
            if (n.type === "mergerNode") return "#06b6d4";
            if (n.type === "resourceNode") return "#f97316";
            if (n.type === "outputNode") return "#10b981";
            return "#3b82f6";
          }}
          maskColor="rgba(15, 23, 42, 0.75)" 
          className="!bg-slate-900 !border !border-slate-700 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}
