"use client";
import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";

export interface ConveyorBridgeEdgeData extends Record<string, unknown> {
  turnX?: number;
  waypoints?: { x: number; y: number }[];
  isMultiBelt?: boolean;
  beltTier?: number;
  edgeColor?: string;
  shortLabel?: string;
  detailTooltip?: string;
  labelX?: number;
  labelY?: number;
}

/**
 * Builds a rounded orthogonal SVG path through a series of points.
 */
function buildRoundedOrthogonalPath(
  points: { x: number; y: number }[],
  radius = 8
): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const vIn = { x: curr.x - prev.x, y: curr.y - prev.y };
    const vOut = { x: next.x - curr.x, y: next.y - curr.y };

    const lenIn = Math.hypot(vIn.x, vIn.y);
    const lenOut = Math.hypot(vOut.x, vOut.y);

    if (lenIn < 1e-4 || lenOut < 1e-4) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    const dirIn = { x: vIn.x / lenIn, y: vIn.y / lenIn };
    const dirOut = { x: vOut.x / lenOut, y: vOut.y / lenOut };

    const r = Math.min(radius, lenIn / 2, lenOut / 2);

    const cornerStart = {
      x: curr.x - dirIn.x * r,
      y: curr.y - dirIn.y * r,
    };
    const cornerEnd = {
      x: curr.x + dirOut.x * r,
      y: curr.y + dirOut.y * r,
    };

    d += ` L ${cornerStart.x} ${cornerStart.y}`;
    d += ` Q ${curr.x} ${curr.y} ${cornerEnd.x} ${cornerEnd.y}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;

  return d;
}

export default function ConveyorBridgeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const edgeData = (data || {}) as ConveyorBridgeEdgeData;
  const edgeColor = edgeData.edgeColor || "#38bdf8";
  const isMultiBelt = Boolean(edgeData.isMultiBelt);

  let pathPoints: { x: number; y: number }[] = [];

  if (edgeData.waypoints && edgeData.waypoints.length >= 2) {
    pathPoints = edgeData.waypoints;
  } else if (Math.abs(sourceY - targetY) < 3) {
    // Pure horizontal straight line
    pathPoints = [
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
    ];
  } else {
    // Standard 3-segment orthogonal jog
    const turnX =
      edgeData.turnX !== undefined
        ? edgeData.turnX
        : sourceX + (targetX - sourceX) * 0.5;

    pathPoints = [
      { x: sourceX, y: sourceY },
      { x: turnX, y: sourceY },
      { x: turnX, y: targetY },
      { x: targetX, y: targetY },
    ];
  }

  const path = buildRoundedOrthogonalPath(pathPoints, 10);

  // Label positioning: use explicitly calculated coordinates if provided
  let labelX = edgeData.labelX;
  let labelY = edgeData.labelY;

  if (labelX === undefined || labelY === undefined) {
    if (pathPoints.length === 2) {
      // Straight line midpoint
      labelX = (sourceX + targetX) / 2;
      labelY = sourceY;
    } else {
      // Pick longest horizontal segment for label
      let longestSeg = { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2, len: 0 };
      for (let i = 0; i < pathPoints.length - 1; i++) {
        const p1 = pathPoints[i];
        const p2 = pathPoints[i + 1];
        if (Math.abs(p1.y - p2.y) < 2) {
          const segLen = Math.abs(p2.x - p1.x);
          if (segLen > longestSeg.len) {
            longestSeg = {
              x: (p1.x + p2.x) / 2,
              y: p1.y,
              len: segLen,
            };
          }
        }
      }
      labelX = longestSeg.x;
      labelY = longestSeg.y;
    }
  }

  const shortLabel = edgeData.shortLabel;
  const detailTooltip = edgeData.detailTooltip;

  return (
    <>
      {/* Conveyor Belt Path - Solid, distinct, high-visibility line */}
      <BaseEdge
        id={id}
        path={path}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: isMultiBelt ? 3 : 2.2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }}
        markerEnd={markerEnd}
      />

      {/* Belt Pill Label with Hover Tooltip */}
      {shortLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              zIndex: 10, // Below node cards (z-20) so it never covers cards
            }}
            className="group relative cursor-pointer"
          >
            {/* Pill Label */}
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded shadow-lg text-[10px] font-mono font-medium text-slate-200 border transition-all whitespace-nowrap select-none group-hover:scale-105"
              style={{
                backgroundColor: "#090d16",
                borderColor: edgeColor,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: edgeColor }}
              />
              <span>{shortLabel}</span>
            </div>

            {/* Hover Details Tooltip */}
            {detailTooltip && (
              <div className="hidden group-hover:flex flex-col absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-40 pointer-events-none">
                <div className="bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono rounded px-2.5 py-1.5 shadow-2xl whitespace-nowrap space-y-0.5">
                  {detailTooltip.split("\n").map((line, idx) => (
                    <div
                      key={idx}
                      className={idx === 0 ? "font-semibold text-white" : "text-amber-400"}
                    >
                      {line}
                    </div>
                  ))}
                </div>
                {/* Tooltip beak */}
                <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45 self-center -mt-1" />
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
