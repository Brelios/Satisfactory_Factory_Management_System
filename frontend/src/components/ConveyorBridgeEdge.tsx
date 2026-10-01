"use client";
import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";

export interface ConveyorBridgeEdgeData extends Record<string, unknown> {
  turnX?: number;
  jumps?: number[]; // list of X coordinates where horizontal segments jump over perpendicular lines
  feedDesc?: string;
  isMultiBelt?: boolean;
  beltTier?: number;
  edgeColor?: string;
}

export default function ConveyorBridgeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  label,
  data,
}: EdgeProps) {
  const edgeData = (data || {}) as ConveyorBridgeEdgeData;
  const edgeColor = edgeData.edgeColor || "#38bdf8";
  const isMultiBelt = Boolean(edgeData.isMultiBelt);
  const jumps = (edgeData.jumps || []).sort((a, b) => a - b);

  // Determine turning point (turnX)
  const turnX = edgeData.turnX !== undefined 
    ? edgeData.turnX 
    : sourceX + (targetX - sourceX) * 0.5;

  const isStraightHorizontal = Math.abs(sourceY - targetY) < 3;

  // Helper to draw horizontal segment with physics bridge jump arcs over crossing lines
  const buildHorizontalWithJumps = (
    startX: number,
    endX: number,
    y: number,
    crossingXList: number[]
  ): string => {
    let d = "";
    let currentX = startX;

    // Filter crossings strictly between startX and endX with clearance
    const validCrossings = crossingXList.filter(cx => cx > startX + 16 && cx < endX - 16);

    for (const cx of validCrossings) {
      if (cx > currentX) {
        d += ` L ${cx - 8} ${y}`;
        // Physics jump arc: semicircular bridge hopping up over the perpendicular line
        // A rx ry x-axis-rotation large-arc sweep x y (sweep=1 curves upwards towards -Y)
        d += ` A 8 8 0 0 1 ${cx + 8} ${y}`;
        currentX = cx + 8;
      }
    }

    d += ` L ${endX} ${y}`;
    return d;
  };

  let path = "";
  let labelX = (sourceX + targetX) / 2;
  let labelY = (sourceY + targetY) / 2;

  const crossingPoints: { x: number; y: number }[] = [];

  if (isStraightHorizontal) {
    // Pure horizontal straight conduit
    path = `M ${sourceX} ${sourceY}`;
    path += buildHorizontalWithJumps(sourceX, targetX, sourceY, jumps);
    labelX = (sourceX + targetX) / 2;
    labelY = sourceY;

    jumps.forEach(jx => {
      if (jx > sourceX + 16 && jx < targetX - 16) {
        crossingPoints.push({ x: jx, y: sourceY });
      }
    });
  } else {
    // Orthogonal 3-segment conduit: Horizontal -> Vertical -> Horizontal
    const r = Math.min(12, Math.abs(targetY - sourceY) / 2, Math.abs(turnX - sourceX) / 2);
    const goingDown = targetY > sourceY;

    // Segment 1: from sourceX to turnX at sourceY
    path = `M ${sourceX} ${sourceY}`;
    const seg1Jumps = jumps.filter(jx => jx < turnX - r);
    path += buildHorizontalWithJumps(sourceX, turnX - r, sourceY, seg1Jumps);

    seg1Jumps.forEach(jx => {
      if (jx > sourceX + 16 && jx < turnX - r) {
        crossingPoints.push({ x: jx, y: sourceY });
      }
    });

    // Corner 1: rounded turn from horizontal into vertical track
    if (goingDown) {
      path += ` Q ${turnX} ${sourceY} ${turnX} ${sourceY + r}`;
      // Segment 2: vertical drop down the clear corridor track
      path += ` L ${turnX} ${targetY - r}`;
      // Corner 2: rounded turn from vertical into horizontal
      path += ` Q ${turnX} ${targetY} ${turnX + r} ${targetY}`;
    } else {
      path += ` Q ${turnX} ${sourceY} ${turnX} ${sourceY - r}`;
      path += ` L ${turnX} ${targetY + r}`;
      path += ` Q ${turnX} ${targetY} ${turnX + r} ${targetY}`;
    }

    // Segment 3: horizontal run from turnX to targetX at targetY
    const seg3Jumps = jumps.filter(jx => jx > turnX + r);
    path += buildHorizontalWithJumps(turnX + r, targetX, targetY, seg3Jumps);

    seg3Jumps.forEach(jx => {
      if (jx > turnX + r && jx < targetX - 16) {
        crossingPoints.push({ x: jx, y: targetY });
      }
    });

    // Label placed on horizontal segment before or after turn
    labelX = (turnX + targetX) / 2;
    labelY = targetY;
  }

  return (
    <>
      {/* Base Conveyor Edge Path */}
      <BaseEdge
        id={id}
        path={path}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: isMultiBelt ? 2.5 : 1.8,
          strokeDasharray: isMultiBelt ? "8,4" : undefined,
        }}
        markerEnd={markerEnd}
      />

      {/* Physics Overpass Bridge Visual Halos */}
      {crossingPoints.map((pt, i) => (
        <g key={`bridge-${id}-${i}`} className="pointer-events-none">
          {/* Underpass gap shadow */}
          <circle 
            cx={pt.x} 
            cy={pt.y} 
            r={10} 
            fill="#090d16" 
            stroke={edgeColor} 
            strokeWidth={1} 
            strokeDasharray="2,2" 
            opacity={0.9} 
          />
          {/* Overpass Bridge Icon Badge */}
          <circle 
            cx={pt.x} 
            cy={pt.y - 7} 
            r={3.5} 
            fill={edgeColor} 
            className="animate-pulse" 
          />
        </g>
      ))}

      {/* Edge Label Badge */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="bg-slate-950/95 border border-slate-700/80 hover:border-sky-500 rounded px-2 py-1 shadow-lg text-[9.5px] font-mono text-slate-200 transition-colors whitespace-pre-line text-center z-10"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
