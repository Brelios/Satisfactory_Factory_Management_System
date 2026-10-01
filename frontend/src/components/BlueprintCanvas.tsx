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
import ConveyorBridgeEdge from "./ConveyorBridgeEdge";

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

const edgeTypes = {
  conveyorBridge: ConveyorBridgeEdge as any,
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
    const COL_SPACING = 720; // Machine-to-machine horizontal pitch
    const ROW_SPACING = 300; // Machine-to-machine vertical pitch
    const NODE_OFFSET_X = 400; // Offset after resource miners (col 0)
    const SPLITTER_CORRIDOR_OFFSET = 290; // Place splitters in parent's lane

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

    // 5. Build Conveyor Splitters & Corridor Tracks
    // Track vertical conduit track coordinates per corridor to prevent vertical line overlap
    // and provide crossing coordinates for horizontal bridge jump arcs
    const corridorVerticalTracks: Record<number, number[]> = {};

    const outgoingGroups: Record<string, typeof result.connections> = {};
    result.connections.forEach(conn => {
      const key = `${conn.from_step}__${conn.item}`;
      if (!outgoingGroups[key]) outgoingGroups[key] = [];
      outgoingGroups[key].push(conn);
    });

    // Helper: assign dedicated vertical track in a column corridor
    const allocateCorridorTrack = (colIdx: number): number => {
      if (!corridorVerticalTracks[colIdx]) corridorVerticalTracks[colIdx] = [];
      const trackBase = NODE_OFFSET_X + colIdx * COL_SPACING + 470;
      const trackIdx = corridorVerticalTracks[colIdx].length;
      const trackX = trackBase + (trackIdx % 6) * 32;
      corridorVerticalTracks[colIdx].push(trackX);
      return trackX;
    };

    // First pass: create splitters and determine vertical tracks
    interface PendingConnection {
      id: string;
      source: string;
      target: string;
      sourceX: number;
      sourceY: number;
      targetX: number;
      targetY: number;
      turnX: number;
      colIdx: number;
      isMultiBelt: boolean;
      beltTier: number;
      edgeColor: string;
      label: string;
    }

    const pendingConnections: PendingConnection[] = [];

    Object.entries(outgoingGroups).forEach(([key, conns]) => {
      const [fromStepId, itemId] = key.split("__");
      const fromPos = machinePositions[fromStepId];
      if (!fromPos) return;

      const fromDepth = stepDepths[fromStepId] || 0;
      const edgeColor = getMaterialColor(itemId);
      const itemName = itemId.replace(/_/g, " ");

      if (conns.length > 1) {
        // MULTI-BRANCH FEED: Insert Conveyor Splitter in the parent's OWN horizontal lane!
        const totalRate = conns.reduce((sum, c) => sum + c.rate, 0);
        const maxTier = Math.max(...conns.map(c => c.belt_tier), 1);
        const splitterId = `splitter-${fromStepId}-${itemId}`;

        // CRITICAL FIX: Place splitter at parent's Y (+20px for center align)
        // so it NEVER overlaps with other machines in other rows!
        const splitterX = fromPos.x + SPLITTER_CORRIDOR_OFFSET;
        const splitterY = fromPos.y + 20;

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

        // Machine -> Splitter is a 100% STRAIGHT horizontal line in its own lane
        edges.push({
          id: `e-${fromStepId}-${splitterId}`,
          source: fromStepId,
          target: splitterId,
          type: "conveyorBridge",
          animated: true,
          label: `${itemName} • ${totalRate.toFixed(0)}/m (Mk.${maxTier})`,
          data: {
            turnX: splitterX,
            jumps: [],
            isMultiBelt: false,
            beltTier: maxTier,
            edgeColor,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
        });

        // From Splitter -> each Destination Machine
        conns.forEach((conn, cIdx) => {
          const destPos = machinePositions[conn.to_step];
          const destDepth = stepDepths[conn.to_step] ?? fromDepth + 1;
          const turnX = allocateCorridorTrack(fromDepth);

          const feedDesc = conn.feed_description
            ? conn.feed_description.replace("Feeds ", "Feeds: ").replace(" operating normally", "").replace(" underclocked", "")
            : `${conn.rate.toFixed(0)}/m`;

          pendingConnections.push({
            id: `e-${splitterId}-${conn.to_step}-${cIdx}`,
            source: splitterId,
            target: conn.to_step,
            sourceX: splitterX + 130, // splitter right edge
            sourceY: splitterY + 32,  // splitter vertical center
            targetX: destPos ? destPos.x : splitterX + 300,
            targetY: destPos ? destPos.y + 60 : splitterY,
            turnX,
            colIdx: fromDepth,
            isMultiBelt: conn.belt_count > 1,
            beltTier: conn.belt_tier,
            edgeColor,
            label: `↳ ${conn.rate.toFixed(0)}/m (${feedDesc})`,
          });
        });

      } else {
        // SINGLE BRANCH FEED: Direct conduit with dedicated corridor turn
        const conn = conns[0];
        const destPos = machinePositions[conn.to_step];
        const turnX = allocateCorridorTrack(fromDepth);
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

        pendingConnections.push({
          id: `e-${conn.from_step}-${conn.to_step}`,
          source: conn.from_step,
          target: conn.to_step,
          sourceX: fromPos.x + 220,
          sourceY: fromPos.y + 60,
          targetX: destPos ? destPos.x : fromPos.x + 300,
          targetY: destPos ? destPos.y + 60 : fromPos.y + 60,
          turnX,
          colIdx: fromDepth,
          isMultiBelt,
          beltTier: conn.belt_tier,
          edgeColor,
          label: labelText,
        });
      }
    });

    // Second pass: inject jump coordinates for horizontal segments crossing vertical tracks
    pendingConnections.forEach(pc => {
      // Find all vertical tracks in this corridor that this horizontal line crosses
      const corridorTracks = corridorVerticalTracks[pc.colIdx] || [];
      const crossingTracks = corridorTracks.filter(tx => tx !== pc.turnX);

      edges.push({
        id: pc.id,
        source: pc.source,
        target: pc.target,
        type: "conveyorBridge",
        animated: true,
        label: pc.label,
        data: {
          turnX: pc.turnX,
          jumps: crossingTracks,
          isMultiBelt: pc.isMultiBelt,
          beltTier: pc.beltTier,
          edgeColor: pc.edgeColor,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: pc.edgeColor },
      });
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

      const consumingSteps = result.steps.filter(step => step.input_rates[item]);

      if (consumingSteps.length > 1) {
        // Resource feeds multiple lines -> insert Splitter in resource's OWN lane!
        const splitterId = `res-splitter-${item}`;

        nodes.push({
          id: splitterId,
          type: "splitterNode",
          position: { x: 220, y: y + 20 },
          data: {
            item,
            totalIn: rate,
            outputs: consumingSteps.map(s => ({ to: s.step_id, rate: s.input_rates[item] })),
            beltTier: 3,
          },
        });

        // Miner -> Splitter (straight horizontal)
        edges.push({
          id: `e-${resId}-${splitterId}`,
          source: resId,
          target: splitterId,
          type: "conveyorBridge",
          animated: true,
          label: `${item.replace(/_/g, " ")} • ${rate.toFixed(0)}/m`,
          data: {
            turnX: 220,
            jumps: [],
            isMultiBelt: false,
            beltTier: 3,
            edgeColor: "#f59e0b",
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
        });

        // Splitter -> each Consuming Step with bridge jumper
        consumingSteps.forEach((step, sIdx) => {
          const consumeRate = step.input_rates[item];
          const destPos = machinePositions[step.step_id];
          const turnX = 350 + (sIdx % 3) * 20;

          edges.push({
            id: `e-${splitterId}-${step.step_id}-${sIdx}`,
            source: splitterId,
            target: step.step_id,
            type: "conveyorBridge",
            animated: true,
            label: `↳ ${consumeRate.toFixed(0)}/m`,
            data: {
              turnX,
              jumps: [],
              isMultiBelt: false,
              beltTier: 3,
              edgeColor: "#f59e0b",
            },
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
          type: "conveyorBridge",
          animated: true,
          label: `${item.replace(/_/g, " ")} • ${consumeRate.toFixed(0)}/m`,
          data: {
            turnX: 260,
            jumps: [],
            isMultiBelt: false,
            beltTier: 3,
            edgeColor: "#f59e0b",
          },
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

      result.steps.forEach(step => {
        if (step.output_rates[item]) {
          const prodRate = step.output_rates[item];
          edges.push({
            id: `e-${step.step_id}-${id}`,
            source: step.step_id,
            target: id,
            type: "conveyorBridge",
            animated: true,
            label: `✓ ${item.replace(/_/g, " ")} • ${prodRate.toFixed(0)}/m`,
            data: {
              turnX: outX - 60,
              jumps: [],
              isMultiBelt: false,
              beltTier: 3,
              edgeColor: "#10b981",
            },
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
        edgeTypes={edgeTypes}
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
