"use client";
import React, { useMemo, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import type { SolveResponse, GameItem } from "@/lib/types";
import MachineNode from "./MachineNode";
import ResourceNode from "./ResourceNode";
import OutputNode from "./OutputNode";
import SplitterNode from "./SplitterNode";
import MergerNode from "./MergerNode";
import ConveyorBridgeEdge from "./ConveyorBridgeEdge";
import { getItemColor, formatItemName } from "@/lib/colors";
import { FACTORY_PRESETS, type FactoryPreset } from "@/lib/presets";

interface BlueprintCanvasProps {
  result: SolveResponse | null;
  isLoading: boolean;
  items: GameItem[];
  onSelectPreset?: (preset: FactoryPreset) => void;
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

// Node dimensions
const NODE_WIDTH = 260;
const NODE_HEIGHT = 175;
const SPLITTER_WIDTH = 155;
const SPLITTER_HEIGHT = 90;

// Spacing constants
const COL_SPACING = 880; // Horizontal column pitch
const ROW_SPACING = 340; // Vertical row pitch
const NODE_OFFSET_X = 500; // Starting X after raw resource miners
const SPLITTER_X_OFFSET = 400; // Splitter X distance from its source machine (140px gap)

export default function BlueprintCanvas({
  result,
  isLoading,
  onSelectPreset,
}: BlueprintCanvasProps) {
  const [legendOpen, setLegendOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { initialNodes, initialEdges, activeItems } = useMemo(() => {
    if (!result || !result.steps.length) {
      return { initialNodes: [], initialEdges: [], activeItems: [] };
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const encounteredItems = new Set<string>();

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
            const incoming = result.connections.filter((c) => c.to_step === stepId);
            if (!incoming.length) return 999;
            const supplierRows = incoming
              .map((c) => stepRowIndex[c.from_step])
              .filter((r) => r !== undefined);
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

    const maxRowsInAnyCol = Math.max(
      ...Object.values(columns).map((c) => c.length),
      Object.keys(result.resource_usage).length,
      Object.keys(result.target_outputs).length,
      1
    );

    // 4. Place Machine Nodes
    const stepLookup = new Map(result.steps.map((s) => [s.step_id, s]));
    const machinePositions: Record<string, { x: number; y: number; colIdx: number; rowIdx: number }> = {};

    sortedColKeys.forEach((colIdx) => {
      const stepIdsInCol = columns[colIdx];
      const colHeight = stepIdsInCol.length;
      const yOffset = ((maxRowsInAnyCol - colHeight) * ROW_SPACING) / 2;

      stepIdsInCol.forEach((stepId, rowIdx) => {
        const step = stepLookup.get(stepId);
        if (!step) return;

        const x = NODE_OFFSET_X + colIdx * COL_SPACING;
        const y = yOffset + rowIdx * ROW_SPACING;
        machinePositions[step.step_id] = { x, y, colIdx, rowIdx };

        // Collect all items for legend
        Object.keys(step.input_rates || {}).forEach((i) => encounteredItems.add(i));
        Object.keys(step.output_rates || {}).forEach((i) => encounteredItems.add(i));

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
            chainColor: getItemColor(Object.keys(step.output_rates)[0] || ""),
            recipeId: step.recipe_id,
            normalMachineCount: step.normal_machine_count,
            underclockedMachineCount: step.underclocked_machine_count,
            underclockClockSpeed: step.underclock_clock_speed,
          },
        });
      });
    });

    // Helper: Calculate exact handle Y on destination machine for a specific input item
    const getDestinationHandleY = (destStepId: string, itemId: string): number => {
      const destPos = machinePositions[destStepId];
      if (!destPos) return 0;
      const step = stepLookup.get(destStepId);
      if (!step) return destPos.y + NODE_HEIGHT * 0.5;

      const inputItems = Object.keys(step.input_rates || {});
      const itemIdx = inputItems.indexOf(itemId);
      if (itemIdx === -1 || inputItems.length === 1) {
        return destPos.y + NODE_HEIGHT * 0.5;
      }
      const topPercent = 0.3 + (itemIdx / (inputItems.length - 1)) * 0.4;
      return destPos.y + NODE_HEIGHT * topPercent;
    };

    // Helper to determine belt tier for a given rate
    const getTierForRate = (r: number): number => {
      if (r <= 60) return 1;
      if (r <= 120) return 2;
      if (r <= 270) return 3;
      if (r <= 480) return 4;
      if (r <= 780) return 5;
      return 6;
    };

    // Corridor vertical track allocator to avoid parallel vertical overlaps
    const corridorTrackCounts: Record<number, number> = {};
    const allocateCorridorTrack = (colIdx: number, baseOffset = 35): number => {
      if (!corridorTrackCounts[colIdx]) corridorTrackCounts[colIdx] = 0;
      const trackIdx = corridorTrackCounts[colIdx]++;
      const colBaseX = NODE_OFFSET_X + colIdx * COL_SPACING + SPLITTER_X_OFFSET + SPLITTER_WIDTH + baseOffset;
      return colBaseX + (trackIdx % 6) * 24;
    };

    // Long-distance inter-row transit channel tracker
    let transitChannelCounter = 0;

    // 5. Build Conveyor Splitters & Conveyor Edges
    const outgoingGroups: Record<string, typeof result.connections> = {};
    result.connections.forEach((conn) => {
      const key = `${conn.from_step}__${conn.item}`;
      if (!outgoingGroups[key]) outgoingGroups[key] = [];
      outgoingGroups[key].push(conn);
      encounteredItems.add(conn.item);
    });

    Object.entries(outgoingGroups).forEach(([key, conns]) => {
      const [fromStepId, itemId] = key.split("__");
      const fromPos = machinePositions[fromStepId];
      if (!fromPos) return;

      const fromDepth = fromPos.colIdx;
      const edgeColor = getItemColor(itemId);
      const itemName = formatItemName(itemId);

      if (conns.length > 1) {
        // MULTI-BRANCH FEED: Insert Conveyor Splitter in the parent's horizontal lane
        const totalRate = conns.reduce((sum, c) => sum + c.rate, 0);
        const inputTier = getTierForRate(totalRate);
        const splitterId = `splitter-${fromStepId}-${itemId}`;

        const splitterHeight = Math.max(90, 48 + conns.length * 26);
        const splitterX = fromPos.x + SPLITTER_X_OFFSET;
        const splitterY = fromPos.y + (NODE_HEIGHT - splitterHeight) / 2;

        nodes.push({
          id: splitterId,
          type: "splitterNode",
          position: { x: splitterX, y: splitterY },
          data: {
            item: itemId,
            totalIn: totalRate,
            outputs: conns.map((c) => ({ to: c.to_step, rate: c.rate })),
            beltTier: inputTier,
          },
        });

        // Machine -> Splitter: 100% straight horizontal line centered in the 140px gap
        const machToSplitterSrc = {
          x: fromPos.x + NODE_WIDTH,
          y: fromPos.y + NODE_HEIGHT * 0.5,
        };
        const machToSplitterDst = {
          x: splitterX,
          y: splitterY + splitterHeight * 0.5,
        };

        edges.push({
          id: `e-${fromStepId}-${splitterId}`,
          source: fromStepId,
          sourceHandle: "output",
          target: splitterId,
          targetHandle: "input",
          type: "conveyorBridge",
          data: {
            waypoints: [machToSplitterSrc, machToSplitterDst],
            isMultiBelt: false,
            beltTier: inputTier,
            edgeColor,
            shortLabel: `${itemName} ${totalRate.toFixed(0)}/m`,
            detailTooltip: `${itemName} • ${totalRate.toFixed(1)}/m\nMk.${inputTier} conveyor feed into Splitter`,
            labelX: (machToSplitterSrc.x + machToSplitterDst.x) / 2,
            labelY: machToSplitterSrc.y - 14,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
        });

        // Splitter -> each Destination Machine
        conns.forEach((conn, cIdx) => {
          const destPos = machinePositions[conn.to_step];
          const destDepth = destPos ? destPos.colIdx : fromDepth + 1;
          const targetY = getDestinationHandleY(conn.to_step, itemId);
          const targetX = destPos ? destPos.x : splitterX + 350;

          // Branch handle Y on Splitter
          const splitCount = conns.length;
          const topPercent = splitCount === 1 ? 0.5 : 0.28 + (cIdx / (splitCount - 1)) * 0.44;
          const splitBranchSrc = {
            x: splitterX + SPLITTER_WIDTH,
            y: splitterY + splitterHeight * topPercent,
          };

          const isDirectNeighbor = destDepth === fromDepth + 1;
          let waypoints: { x: number; y: number }[] = [];
          let labelX = targetX - 80;
          let labelY = targetY;

          // Corridor track is guaranteed to be at least 35px past the splitter right edge
          const minCorridorX = splitterX + SPLITTER_WIDTH + 35;
          const allocatedX = allocateCorridorTrack(fromDepth, 35);
          const turnX = Math.max(minCorridorX, allocatedX);

          if (isDirectNeighbor) {
            // Adjacent column: turn through vertical corridor
            waypoints = [
              splitBranchSrc,
              { x: turnX, y: splitBranchSrc.y },
              { x: turnX, y: targetY },
              { x: targetX, y: targetY },
            ];
            labelX = turnX + (targetX - turnX) * 0.45;
            labelY = targetY;
          } else {
            // Long-distance / column-skipping: route via inter-row transit corridor to prevent passing through cards!
            const transitChannelY =
              ROW_SPACING * 0.5 +
              Math.min(fromPos.rowIdx, destPos?.rowIdx ?? 0) * ROW_SPACING +
              ((transitChannelCounter++ % 4) - 2) * 22;

            const turnX2 = targetX - 50 - (cIdx % 3) * 20;

            waypoints = [
              splitBranchSrc,
              { x: turnX, y: splitBranchSrc.y },
              { x: turnX, y: transitChannelY },
              { x: turnX2, y: transitChannelY },
              { x: turnX2, y: targetY },
              { x: targetX, y: targetY },
            ];
            labelX = turnX2 + (targetX - turnX2) * 0.5;
            labelY = targetY;
          }

          const beltInfo = conn.belt_count > 1 ? `${conn.belt_count}× Mk.${conn.belt_tier}` : `Mk.${conn.belt_tier}`;
          const feedDesc = conn.feed_description || `Feeds ${conn.rate.toFixed(0)}/m`;

          edges.push({
            id: `e-${splitterId}-${conn.to_step}-${cIdx}`,
            source: splitterId,
            sourceHandle: `out-${cIdx}`,
            target: conn.to_step,
            targetHandle: itemId,
            type: "conveyorBridge",
            data: {
              waypoints,
              isMultiBelt: conn.belt_count > 1,
              beltTier: conn.belt_tier,
              edgeColor,
              shortLabel: `↳ ${conn.rate.toFixed(0)}/m`,
              detailTooltip: `${itemName} • ${conn.rate.toFixed(1)}/m\nBelt: ${beltInfo}\n${feedDesc}`,
              labelX,
              labelY,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
          });
        });
      } else {
        // SINGLE BRANCH FEED: Direct conveyor between machines
        const conn = conns[0];
        const destPos = machinePositions[conn.to_step];
        const destDepth = destPos ? destPos.colIdx : fromDepth + 1;
        const targetY = getDestinationHandleY(conn.to_step, itemId);
        const targetX = destPos ? destPos.x : fromPos.x + 350;

        const sourcePt = {
          x: fromPos.x + NODE_WIDTH,
          y: fromPos.y + NODE_HEIGHT * 0.5,
        };

        const isDirectNeighbor = destDepth === fromDepth + 1;
        let waypoints: { x: number; y: number }[] = [];
        let labelX = targetX - 90;
        let labelY = targetY;

        if (isDirectNeighbor) {
          if (Math.abs(sourcePt.y - targetY) < 3) {
            // Straight horizontal line
            waypoints = [sourcePt, { x: targetX, y: targetY }];
            labelX = (sourcePt.x + targetX) / 2;
            labelY = targetY - 14;
          } else {
            const turnX = allocateCorridorTrack(fromDepth, 50);
            waypoints = [
              sourcePt,
              { x: turnX, y: sourcePt.y },
              { x: turnX, y: targetY },
              { x: targetX, y: targetY },
            ];
            labelX = turnX + (targetX - turnX) * 0.45;
            labelY = targetY;
          }
        } else {
          // Long-distance / column-skipping: route via inter-row transit channel
          const transitChannelY =
            ROW_SPACING * 0.5 +
            Math.min(fromPos.rowIdx, destPos?.rowIdx ?? 0) * ROW_SPACING +
            ((transitChannelCounter++ % 4) - 2) * 22;

          const turnX1 = allocateCorridorTrack(fromDepth, 50);
          const turnX2 = targetX - 60;

          waypoints = [
            sourcePt,
            { x: turnX1, y: sourcePt.y },
            { x: turnX1, y: transitChannelY },
            { x: turnX2, y: transitChannelY },
            { x: turnX2, y: targetY },
            { x: targetX, y: targetY },
          ];
          labelX = turnX2 + (targetX - turnX2) * 0.5;
          labelY = targetY;
        }

        const beltInfo = conn.belt_count > 1 ? `${conn.belt_count}× Mk.${conn.belt_tier}` : `Mk.${conn.belt_tier}`;
        const feedDesc = conn.feed_description || "";

        edges.push({
          id: `e-${conn.from_step}-${conn.to_step}`,
          source: conn.from_step,
          sourceHandle: "output",
          target: conn.to_step,
          targetHandle: itemId,
          type: "conveyorBridge",
          data: {
            waypoints,
            isMultiBelt: conn.belt_count > 1,
            beltTier: conn.belt_tier,
            edgeColor,
            shortLabel: `${itemName} ${conn.rate.toFixed(0)}/m`,
            detailTooltip: `${itemName} • ${conn.rate.toFixed(1)}/m\nBelt: ${beltInfo}\n${feedDesc}`.trim(),
            labelX,
            labelY,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
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
      const itemColor = getItemColor(item);
      const itemName = formatItemName(item);
      encounteredItems.add(item);

      nodes.push({
        id: resId,
        type: "resourceNode",
        position: { x: 40, y: y + 25 },
        data: { label: item, rate, color: itemColor },
      });

      const consumingSteps = result.steps.filter((step) => step.input_rates && step.input_rates[item]);

      if (consumingSteps.length > 1) {
        // Resource feeds multiple lines -> insert Splitter in resource's lane
        const splitterId = `res-splitter-${item}`;
        const splitterX = 220;
        const splitterY = y + 20;

        nodes.push({
          id: splitterId,
          type: "splitterNode",
          position: { x: splitterX, y: splitterY },
          data: {
            item,
            totalIn: rate,
            outputs: consumingSteps.map((s) => ({ to: s.step_id, rate: s.input_rates[item] })),
            beltTier: 3,
          },
        });

        // Miner -> Splitter (straight horizontal)
        edges.push({
          id: `e-${resId}-${splitterId}`,
          source: resId,
          sourceHandle: "output",
          target: splitterId,
          targetHandle: "input",
          type: "conveyorBridge",
          data: {
            waypoints: [
              { x: 40 + 112, y: y + 25 + 56 },
              { x: splitterX, y: splitterY + SPLITTER_HEIGHT * 0.5 },
            ],
            isMultiBelt: false,
            beltTier: 3,
            edgeColor: itemColor,
            shortLabel: `${itemName} ${rate.toFixed(0)}/m`,
            detailTooltip: `${itemName} • ${rate.toFixed(1)}/m\nRaw extraction feed into splitter`,
            labelX: (40 + 112 + splitterX) / 2,
            labelY: y + 25 + 56 - 14,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: itemColor, width: 14, height: 14 },
        });

        // Splitter -> each Consuming Step
        consumingSteps.forEach((step, sIdx) => {
          const consumeRate = step.input_rates[item];
          const destPos = machinePositions[step.step_id];
          const targetY = getDestinationHandleY(step.step_id, item);
          const targetX = destPos ? destPos.x : NODE_OFFSET_X;

          const topPercent =
            consumingSteps.length === 1
              ? 0.5
              : 0.28 + (sIdx / (consumingSteps.length - 1)) * 0.44;
          const splitBranchSrc = {
            x: splitterX + SPLITTER_WIDTH,
            y: splitterY + SPLITTER_HEIGHT * topPercent,
          };

          const turnX = splitterX + SPLITTER_WIDTH + 40 + (sIdx % 3) * 22;

          edges.push({
            id: `e-${splitterId}-${step.step_id}-${sIdx}`,
            source: splitterId,
            sourceHandle: `out-${sIdx}`,
            target: step.step_id,
            targetHandle: item,
            type: "conveyorBridge",
            data: {
              waypoints: [
                splitBranchSrc,
                { x: turnX, y: splitBranchSrc.y },
                { x: turnX, y: targetY },
                { x: targetX, y: targetY },
              ],
              isMultiBelt: false,
              beltTier: 3,
              edgeColor: itemColor,
              shortLabel: `↳ ${consumeRate.toFixed(0)}/m`,
              detailTooltip: `${itemName} • ${consumeRate.toFixed(1)}/m\nFeeds into ${step.recipe_name}`,
              labelX: turnX + (targetX - turnX) * 0.45,
              labelY: targetY,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: itemColor, width: 14, height: 14 },
          });
        });
      } else if (consumingSteps.length === 1) {
        const step = consumingSteps[0];
        const consumeRate = step.input_rates[item];
        const destPos = machinePositions[step.step_id];
        const targetY = getDestinationHandleY(step.step_id, item);
        const targetX = destPos ? destPos.x : NODE_OFFSET_X;
        const srcPt = { x: 40 + 112, y: y + 25 + 56 };

        const turnX = 220;

        edges.push({
          id: `e-${resId}-${step.step_id}`,
          source: resId,
          sourceHandle: "output",
          target: step.step_id,
          targetHandle: item,
          type: "conveyorBridge",
          data: {
            waypoints: [
              srcPt,
              { x: turnX, y: srcPt.y },
              { x: turnX, y: targetY },
              { x: targetX, y: targetY },
            ],
            isMultiBelt: false,
            beltTier: 3,
            edgeColor: itemColor,
            shortLabel: `${itemName} ${consumeRate.toFixed(0)}/m`,
            detailTooltip: `${itemName} • ${consumeRate.toFixed(1)}/m\nDirect extraction to ${step.recipe_name}`,
            labelX: turnX + (targetX - turnX) * 0.45,
            labelY: targetY,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: itemColor, width: 14, height: 14 },
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
      const itemColor = getItemColor(item);
      const itemName = formatItemName(item);
      encounteredItems.add(item);

      nodes.push({
        id,
        type: "outputNode",
        position: { x: outX, y: y + 25 },
        data: { label: item, rate },
      });

      result.steps.forEach((step) => {
        if (step.output_rates && step.output_rates[item]) {
          const prodRate = step.output_rates[item];
          const fromPos = machinePositions[step.step_id];
          if (!fromPos) return;

          const srcPt = {
            x: fromPos.x + NODE_WIDTH,
            y: fromPos.y + NODE_HEIGHT * 0.5,
          };
          const targetPt = {
            x: outX,
            y: y + 25 + 40,
          };

          const turnX = outX - 70;

          edges.push({
            id: `e-${step.step_id}-${id}`,
            source: step.step_id,
            sourceHandle: "output",
            target: id,
            targetHandle: "input",
            type: "conveyorBridge",
            data: {
              waypoints: [
                srcPt,
                { x: turnX, y: srcPt.y },
                { x: turnX, y: targetPt.y },
                targetPt,
              ],
              isMultiBelt: false,
              beltTier: 3,
              edgeColor: itemColor,
              shortLabel: `✓ ${prodRate.toFixed(0)}/m`,
              detailTooltip: `${itemName} • ${prodRate.toFixed(1)}/m\nOutput to factory storage`,
              labelX: turnX + (targetPt.x - turnX) * 0.45,
              labelY: targetPt.y,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: itemColor, width: 14, height: 14 },
          });
        }
      });
    });

    return {
      initialNodes: nodes,
      initialEdges: edges,
      activeItems: Array.from(encounteredItems),
    };
  }, [result]);

  // Compute upstream/downstream highlighted subgraphs when a node is clicked
  const { highlightedNodes, highlightedEdges } = useMemo(() => {
    if (!selectedNodeId) return { highlightedNodes: null, highlightedEdges: null };

    const hNodes = new Set<string>([selectedNodeId]);
    const hEdges = new Set<string>();

    // BFS Upstream
    const upstreamQueue = [selectedNodeId];
    while (upstreamQueue.length > 0) {
      const curr = upstreamQueue.shift()!;
      initialEdges.forEach((e) => {
        if (e.target === curr) {
          hEdges.add(e.id);
          if (!hNodes.has(e.source)) {
            hNodes.add(e.source);
            upstreamQueue.push(e.source);
          }
        }
      });
    }

    // BFS Downstream
    const downstreamQueue = [selectedNodeId];
    while (downstreamQueue.length > 0) {
      const curr = downstreamQueue.shift()!;
      initialEdges.forEach((e) => {
        if (e.source === curr) {
          hEdges.add(e.id);
          if (!hNodes.has(e.target)) {
            hNodes.add(e.target);
            downstreamQueue.push(e.target);
          }
        }
      });
    }

    return { highlightedNodes: hNodes, highlightedEdges: hEdges };
  }, [selectedNodeId, initialEdges]);

  // Apply dimming styles to nodes and edges based on highlighting
  const displayNodes = useMemo(() => {
    if (!highlightedNodes) return initialNodes;
    return initialNodes.map((n) => ({
      ...n,
      style: {
        ...n.style,
        opacity: highlightedNodes.has(n.id) ? 1 : 0.18,
        transition: "opacity 0.25s ease",
      },
    }));
  }, [initialNodes, highlightedNodes]);

  const displayEdges = useMemo(() => {
    if (!highlightedEdges) return initialEdges;
    return initialEdges.map((e) => ({
      ...e,
      style: {
        ...e.style,
        opacity: highlightedEdges.has(e.id) ? 1 : 0.12,
        transition: "opacity 0.25s ease",
      },
    }));
  }, [initialEdges, highlightedEdges]);

  const downloadSvg = () => {
    if (!result?.blueprint_svg) return;
    const blob = new Blob([result.blueprint_svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "satisfactory_factory_blueprint.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border border-slate-700 rounded-lg text-sky-400">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="font-medium text-sm">Calculating optimal blueprint...</div>
      </div>
    );
  }

  // Rich Onboarding Empty State with Presets
  if (!result || !result.steps.length) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 border border-slate-700 rounded-lg p-6 overflow-y-auto">
        <div className="text-center max-w-lg mb-6">
          <div className="text-5xl mb-3">🏭</div>
          <h2 className="text-xl font-bold text-white mb-1.5">
            Satisfactory Factory Blueprint Builder
          </h2>
          <p className="text-xs text-slate-400">
            Configure raw resources or target quotas on the left, or choose an example preset to see an optimal blueprint in one click:
          </p>
        </div>

        {/* Quick-Start Preset Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl w-full">
          {FACTORY_PRESETS.map((preset) => (
            <div
              key={preset.id}
              onClick={() => onSelectPreset && onSelectPreset(preset)}
              className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700 hover:border-sky-500 rounded-xl p-3.5 cursor-pointer transition-all shadow-lg hover:shadow-sky-950/40 text-left group select-none"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl group-hover:scale-110 transition-transform">
                  {preset.icon}
                </span>
                <span className="font-bold text-white text-xs leading-tight">
                  {preset.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mb-3">
                {preset.subtitle}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] font-mono">
                <span className="text-slate-500 capitalize">{preset.mode.replace("_", " ")}</span>
                <span className="text-sky-400 font-bold group-hover:translate-x-0.5 transition-transform">
                  Load Preset →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-950 border border-slate-700 rounded-lg overflow-hidden relative">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) =>
          setSelectedNodeId((prev) => (prev === node.id ? null : node.id))
        }
        onPaneClick={() => setSelectedNodeId(null)}
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

      {/* Floating Canvas Action Toolbar (Top-Right) */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        {selectedNodeId && (
          <button
            onClick={() => setSelectedNodeId(null)}
            className="px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-sky-400 border border-slate-700 rounded-lg text-xs font-mono shadow-xl transition-all"
            title="Clear upstream/downstream highlight"
          >
            Clear Highlight &times;
          </button>
        )}
        <button
          onClick={downloadSvg}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-lg text-xs font-mono shadow-xl transition-all"
          title="Download vector SVG blueprint"
        >
          <span>📥</span>
          <span>Download SVG</span>
        </button>
      </div>

      {/* Floating Material Color Legend (Bottom-Left) */}
      {activeItems.length > 0 && (
        <div className="absolute bottom-4 left-4 z-30 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-3 max-w-[280px] select-none transition-all">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <span>🎨</span>
              <span>Belt Color Legend</span>
            </div>
            <button
              onClick={() => setLegendOpen(!legendOpen)}
              className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
            >
              {legendOpen ? "Collapse" : "Expand"}
            </button>
          </div>

          {legendOpen && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px] font-mono max-h-48 overflow-y-auto pr-1">
              {activeItems.map((item) => (
                <div key={item} className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: getItemColor(item) }}
                  />
                  <span className="text-slate-300 truncate" title={formatItemName(item)}>
                    {formatItemName(item)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
