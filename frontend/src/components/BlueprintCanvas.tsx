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
  highlightedOffenderId?: string | null;
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
const NODE_WIDTH = 290;
const NODE_HEIGHT = 175;
const SPLITTER_WIDTH = 155;
const SPLITTER_HEIGHT = 90;

// Spacing constants
const COL_SPACING = 920; // Horizontal column pitch
const ROW_SPACING = 350; // Vertical row pitch
const NODE_OFFSET_X = 520; // Starting X after raw resource miners
const SPLITTER_X_OFFSET = 420; // Splitter X distance from its source machine (130px gap)

export default function BlueprintCanvas({
  result,
  isLoading,
  onSelectPreset,
  highlightedOffenderId,
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

        const pMachs = result.logistics?.machines?.filter(
          (m) => m.step_id === step.step_id
        ) || [];

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
            physicalMachines: pMachs,
            isHighlighted: highlightedOffenderId === step.step_id,
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
    const selectedTier = result.logistics?.selected_tier || 3;
    const tierCap =
      result.logistics?.belt_cap && isFinite(result.logistics.belt_cap)
        ? result.logistics.belt_cap
        : [60, 120, 270, 480, 780, 1200][selectedTier - 1] || 270;
    const enforceLimit = result.logistics?.enforce_belt_limit ?? true;

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
        // MULTI-BRANCH FEED: Insert Conveyor Splitter(s) in the parent's horizontal lane
        const totalRate = conns.reduce((sum, c) => sum + c.rate, 0);
        const inputTier = getTierForRate(totalRate);
        const isTrunkOverCap = !enforceLimit && totalRate > tierCap + 1e-4;
        const trunkUtil = tierCap > 0 ? Math.min(100, Math.round((totalRate / tierCap) * 100)) : 100;
        const trunkLabel = isTrunkOverCap
          ? `⚠️ ${totalRate.toFixed(0)}/m (> Mk.${selectedTier} ${tierCap}/m - needs ${Math.ceil(totalRate / tierCap)} lanes)`
          : `${itemName} ${totalRate.toFixed(0)}/${tierCap} (${trunkUtil}%)`;

        // If conns.length > 3, chain splitters so NO splitter has > 3 outputs
        const MAX_OUT_PER_SPLITTER = 2;
        const splitterChunks: (typeof conns)[] = [];
        for (let i = 0; i < conns.length; i += MAX_OUT_PER_SPLITTER) {
          splitterChunks.push(conns.slice(i, i + MAX_OUT_PER_SPLITTER));
        }

        let prevSplitterId: string | null = null;
        let prevSplitterX = fromPos.x + SPLITTER_X_OFFSET;
        let runningFeedRate = totalRate;

        splitterChunks.forEach((chunk, chunkIdx) => {
          const sId = `splitter-${fromStepId}-${itemId}-${chunkIdx + 1}`;
          const sX = fromPos.x + SPLITTER_X_OFFSET + chunkIdx * 190;
          const sHeight = Math.max(90, 48 + (chunk.length + (chunkIdx < splitterChunks.length - 1 ? 1 : 0)) * 26);
          const sY = fromPos.y + (NODE_HEIGHT - sHeight) / 2;

          const sOutputs = chunk.map((c) => ({ to: c.to_step, rate: c.rate }));
          if (chunkIdx < splitterChunks.length - 1) {
            const passThroughRate = conns
              .slice((chunkIdx + 1) * MAX_OUT_PER_SPLITTER)
              .reduce((sum, c) => sum + c.rate, 0);
            sOutputs.push({ to: `splitter-${fromStepId}-${itemId}-${chunkIdx + 2}`, rate: passThroughRate });
          }

          nodes.push({
            id: sId,
            type: "splitterNode",
            position: { x: sX, y: sY },
            data: {
              item: itemId,
              totalIn: runningFeedRate,
              outputs: sOutputs,
              beltTier: getTierForRate(runningFeedRate),
              isHighlighted: highlightedOffenderId === sId,
            },
          });

          // Feed into this splitter
          if (chunkIdx === 0) {
            // Machine -> First Splitter: straight horizontal line
            const machToSplitterSrc = {
              x: fromPos.x + NODE_WIDTH,
              y: fromPos.y + NODE_HEIGHT * 0.5,
            };
            const machToSplitterDst = {
              x: sX,
              y: sY + sHeight * 0.5,
            };

            edges.push({
              id: `e-${fromStepId}-${sId}`,
              source: fromStepId,
              sourceHandle: "output",
              target: sId,
              targetHandle: "input",
              type: "conveyorBridge",
              data: {
                waypoints: [machToSplitterSrc, machToSplitterDst],
                isMultiBelt: false,
                beltTier: inputTier,
                edgeColor,
                shortLabel: trunkLabel,
                detailTooltip: `${itemName} • ${totalRate.toFixed(1)}/m\nMk.${inputTier} conveyor feed into Splitter`,
                labelX: (machToSplitterSrc.x + machToSplitterDst.x) / 2,
                labelY: machToSplitterSrc.y - 14,
                isOverCap: isTrunkOverCap,
              },
              markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
            });
          } else if (prevSplitterId) {
            // Manifold hop between chained splitters: straight horizontal line
            const hopSrc = { x: prevSplitterX + SPLITTER_WIDTH, y: sY + sHeight * 0.5 };
            const hopDst = { x: sX, y: sY + sHeight * 0.5 };
            const hopUtil = tierCap > 0 ? Math.min(100, Math.round((runningFeedRate / tierCap) * 100)) : 100;

            edges.push({
              id: `e-${prevSplitterId}-${sId}`,
              source: prevSplitterId,
              sourceHandle: `out-${MAX_OUT_PER_SPLITTER}`,
              target: sId,
              targetHandle: "input",
              type: "conveyorBridge",
              data: {
                waypoints: [hopSrc, hopDst],
                isMultiBelt: false,
                beltTier: getTierForRate(runningFeedRate),
                edgeColor,
                shortLabel: `${runningFeedRate.toFixed(0)}/${tierCap} (${hopUtil}%)`,
                detailTooltip: `Manifold pass-through: ${runningFeedRate.toFixed(1)}/m`,
                labelX: (hopSrc.x + hopDst.x) / 2,
                labelY: hopSrc.y - 14,
                isOverCap: !enforceLimit && runningFeedRate > tierCap + 1e-4,
              },
              markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
            });
          }

          // Splitter -> each Destination Machine in this chunk
          chunk.forEach((conn, cIdx) => {
            const destPos = machinePositions[conn.to_step];
            const destDepth = destPos ? destPos.colIdx : fromDepth + 1;
            const targetY = getDestinationHandleY(conn.to_step, itemId);
            const targetX = destPos ? destPos.x : sX + 350;

            const splitCount = sOutputs.length;
            const topPercent = splitCount === 1 ? 0.5 : 0.28 + (cIdx / (splitCount - 1)) * 0.44;
            const splitBranchSrc = {
              x: sX + SPLITTER_WIDTH,
              y: sY + sHeight * topPercent,
            };

            const isDirectNeighbor = destDepth === fromDepth + 1;
            let waypoints: { x: number; y: number }[] = [];
            let labelX = targetX - 80;
            let labelY = targetY;

            const minCorridorX = sX + SPLITTER_WIDTH + 35;
            const allocatedX = allocateCorridorTrack(fromDepth, 35);
            const turnX = Math.max(minCorridorX, allocatedX);

            if (isDirectNeighbor) {
              waypoints = [
                splitBranchSrc,
                { x: turnX, y: splitBranchSrc.y },
                { x: turnX, y: targetY },
                { x: targetX, y: targetY },
              ];
              labelX = turnX + (targetX - turnX) * 0.45;
              labelY = targetY;
            } else {
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

            const branchIsOver = !enforceLimit && conn.rate > tierCap + 1e-4;
            const branchUtil = tierCap > 0 ? Math.min(100, Math.round((conn.rate / tierCap) * 100)) : 100;
            const branchLabel = branchIsOver
              ? `⚠️ ↳ ${conn.rate.toFixed(0)}/m (> ${tierCap})`
              : `↳ ${conn.rate.toFixed(0)}/${tierCap} (${branchUtil}%)`;
            const beltInfo = conn.belt_count > 1 ? `${conn.belt_count}× Mk.${conn.belt_tier}` : `Mk.${conn.belt_tier}`;

            edges.push({
              id: `e-${sId}-${conn.to_step}-${cIdx}`,
              source: sId,
              sourceHandle: `out-${cIdx}`,
              target: conn.to_step,
              targetHandle: itemId,
              type: "conveyorBridge",
              data: {
                waypoints,
                isMultiBelt: conn.belt_count > 1,
                beltTier: conn.belt_tier,
                edgeColor,
                shortLabel: branchLabel,
                detailTooltip: `${itemName} • ${conn.rate.toFixed(1)}/m\nBelt: ${beltInfo}\n${conn.feed_description || "Branch feed"}`,
                labelX,
                labelY,
                isOverCap: branchIsOver,
              },
              markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
            });
          });

          const chunkUsed = chunk.reduce((sum, c) => sum + c.rate, 0);
          runningFeedRate -= chunkUsed;
          prevSplitterId = sId;
          prevSplitterX = sX;
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

        const directIsOver = !enforceLimit && conn.rate > tierCap + 1e-4;
        const directUtil = tierCap > 0 ? Math.min(100, Math.round((conn.rate / tierCap) * 100)) : 100;
        const directLabel = directIsOver
          ? `⚠️ ${itemName} ${conn.rate.toFixed(0)}/m (> Mk.${selectedTier} ${tierCap}/m - needs ${Math.ceil(conn.rate / tierCap)} lanes)`
          : `${itemName} ${conn.rate.toFixed(0)}/${tierCap} (${directUtil}%)`;
        const beltInfo = conn.belt_count > 1 ? `${conn.belt_count}× Mk.${conn.belt_tier}` : `Mk.${conn.belt_tier}`;

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
            shortLabel: directLabel,
            detailTooltip: `${itemName} • ${conn.rate.toFixed(1)}/m\nBelt: ${beltInfo}\n${conn.feed_description || ""}`.trim(),
            labelX,
            labelY,
            isOverCap: directIsOver,
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
        data: { label: item, rate, color: itemColor, isHighlighted: highlightedOffenderId === resId },
      });

      const consumingSteps = result.steps.filter((step) => step.input_rates && step.input_rates[item]);

      if (consumingSteps.length > 1) {
        // Resource feeds multiple lines -> insert Splitter in resource's lane
        const splitterId = `res-splitter-${item}`;
        const splitterX = 220;
        const splitterY = y + 20;
        const resIsOver = !enforceLimit && rate > tierCap + 1e-4;
        const resUtil = tierCap > 0 ? Math.min(100, Math.round((rate / tierCap) * 100)) : 100;
        const resLabel = resIsOver
          ? `⚠️ ${itemName} ${rate.toFixed(0)}/m (> Mk.${selectedTier} ${tierCap}/m - needs ${Math.ceil(rate / tierCap)} lanes)`
          : `${itemName} ${rate.toFixed(0)}/${tierCap} (${resUtil}%)`;

        nodes.push({
          id: splitterId,
          type: "splitterNode",
          position: { x: splitterX, y: splitterY },
          data: {
            item,
            totalIn: rate,
            outputs: consumingSteps.map((s) => ({ to: s.step_id, rate: s.input_rates[item] })),
            beltTier: getTierForRate(rate),
            isHighlighted: highlightedOffenderId === splitterId,
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
            beltTier: getTierForRate(rate),
            edgeColor: itemColor,
            shortLabel: resLabel,
            detailTooltip: `${itemName} • ${rate.toFixed(1)}/m\nRaw extraction feed into splitter`,
            labelX: (40 + 112 + splitterX) / 2,
            labelY: y + 25 + 56 - 14,
            isOverCap: resIsOver,
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
          const branchIsOver = !enforceLimit && consumeRate > tierCap + 1e-4;
          const branchUtil = tierCap > 0 ? Math.min(100, Math.round((consumeRate / tierCap) * 100)) : 100;

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
              beltTier: getTierForRate(consumeRate),
              edgeColor: itemColor,
              shortLabel: branchIsOver ? `⚠️ ↳ ${consumeRate.toFixed(0)}/m (> ${tierCap})` : `↳ ${consumeRate.toFixed(0)}/${tierCap} (${branchUtil}%)`,
              detailTooltip: `${itemName} • ${consumeRate.toFixed(1)}/m\nFeeds into ${step.recipe_name}`,
              labelX: turnX + (targetX - turnX) * 0.45,
              labelY: targetY,
              isOverCap: branchIsOver,
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

        const directIsOver = !enforceLimit && consumeRate > tierCap + 1e-4;
        const directUtil =
          tierCap > 0
            ? Math.min(100, Math.round((consumeRate / tierCap) * 100))
            : 100;
        const directLabel = directIsOver
          ? `⚠️ ${itemName} ${consumeRate.toFixed(0)}/m (> Mk.${selectedTier} ${tierCap}/m - needs ${Math.ceil(consumeRate / tierCap)} lanes)`
          : `${itemName} ${consumeRate.toFixed(0)}/${tierCap} (${directUtil}%)`;

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
            beltTier: getTierForRate(consumeRate),
            edgeColor: itemColor,
            shortLabel: directLabel,
            detailTooltip: `${itemName} • ${consumeRate.toFixed(1)}/m\nDirect extraction to ${step.recipe_name}`,
            labelX: turnX + (targetX - turnX) * 0.45,
            labelY: targetY,
            isOverCap: directIsOver,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: itemColor,
            width: 14,
            height: 14,
          },
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
        data: { label: item, rate, isHighlighted: highlightedOffenderId === id },
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
          const outIsOver = !enforceLimit && prodRate > tierCap + 1e-4;
          const outUtil = tierCap > 0 ? Math.min(100, Math.round((prodRate / tierCap) * 100)) : 100;
          const outLabel = outIsOver
            ? `⚠️ ✓ ${prodRate.toFixed(0)}/m (> ${tierCap})`
            : `✓ ${prodRate.toFixed(0)}/${tierCap} (${outUtil}%)`;

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
              beltTier: getTierForRate(prodRate),
              edgeColor: itemColor,
              shortLabel: outLabel,
              detailTooltip: `${itemName} • ${prodRate.toFixed(1)}/m\nOutput to factory storage`,
              labelX: turnX + (targetPt.x - turnX) * 0.45,
              labelY: targetPt.y,
              isOverCap: outIsOver,
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
  }, [result, highlightedOffenderId]);

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
        <div className="absolute bottom-4 left-4 z-30 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-3 max-w-[340px] select-none transition-all">
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
