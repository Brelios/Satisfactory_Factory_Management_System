"use client";

import React, { useState, useRef } from "react";
import { ZoomIn, ZoomOut, Maximize, Download, Image as ImageIcon, Factory } from "lucide-react";

interface BlueprintViewerProps {
  svgContent: string | null;
  isLoading: boolean;
}

export function BlueprintViewer({ svgContent, isLoading }: BlueprintViewerProps) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));
  const handleResetZoom = () => setScale(1);

  const downloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blueprint.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width || 1920;
      canvas.height = img.height || 1080;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0f172a"; // slate-900 background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = "blueprint.png";
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-slate-800 border-b border-slate-700">
        <div className="flex space-x-2">
          <button
            onClick={handleZoomOut}
            disabled={!svgContent || scale <= 0.25}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="flex items-center text-sm text-slate-300 min-w-[3rem] justify-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={!svgContent || scale >= 3}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleResetZoom}
            disabled={!svgContent || scale === 1}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset Zoom"
          >
            <Maximize size={18} />
          </button>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={downloadSvg}
            disabled={!svgContent}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            <span>SVG</span>
          </button>
          <button
            onClick={downloadPng}
            disabled={!svgContent}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ImageIcon size={16} />
            <span>PNG</span>
          </button>
        </div>
      </div>

      {/* Viewer Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem]"
      >
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-sky-400 font-medium animate-pulse">Generating blueprint...</p>
          </div>
        ) : svgContent ? (
          <div
            className="origin-top-left transition-transform duration-200 min-h-full min-w-full flex items-center justify-center p-8"
            style={{ transform: \`scale(\${scale})\` }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
            <Factory size={64} className="mb-4 opacity-50" />
            <p className="text-lg">Configure resources and click Solve to generate a blueprint</p>
          </div>
        )}
      </div>
    </div>
  );
}
