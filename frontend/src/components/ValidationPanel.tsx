"use client";
import React from "react";
import type { LogisticsValidation } from "@/lib/types";

interface ValidationPanelProps {
  validation?: LogisticsValidation;
  onHighlightOffender?: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ValidationPanel({
  validation,
  onHighlightOffender,
  isOpen,
  onClose,
}: ValidationPanelProps) {
  if (!isOpen || !validation) return null;

  const allPassed = validation.checks.every((c) => c.passed);

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡️</span>
          <div>
            <h2 className="font-bold text-sm text-white">Logistics Validation</h2>
            <div className="text-[11px] text-slate-400">
              {allPassed ? (
                <span className="text-emerald-400 font-semibold">
                  ✓ All {validation.checks.length} Checks Passed
                </span>
              ) : (
                <span className="text-red-400 font-semibold">
                  ⚠️ Physical Build Constraints Violated
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
        >
          &times;
        </button>
      </div>

      {/* Body: Checks List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
        {validation.checks.map((chk, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
              chk.passed
                ? "bg-slate-950/50 border-emerald-900/60 text-slate-300"
                : "bg-red-950/40 border-red-800 text-red-200 shadow-lg shadow-red-950/30"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    chk.passed ? "bg-emerald-400" : "bg-red-400 animate-pulse"
                  }`}
                />
                {chk.name}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                  chk.passed
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : "bg-red-900 text-red-100 border border-red-700 font-bold"
                }`}
              >
                {chk.passed ? "PASS" : "FAIL"}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              {chk.details}
            </p>

            {!chk.passed && chk.offending_ids.length > 0 && (
              <div className="pt-1.5 border-t border-red-900/50">
                <div className="text-[10px] text-red-300 uppercase tracking-wider font-semibold mb-1">
                  Offending Entities (click to highlight):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {chk.offending_ids.map((id) => (
                    <button
                      key={id}
                      onClick={() => onHighlightOffender?.(id)}
                      className="px-2 py-0.5 bg-red-950 hover:bg-red-900 text-red-200 border border-red-800 rounded text-[10px] hover:scale-105 active:scale-95 transition-all cursor-pointer font-mono"
                      title={`Highlight ${id} on canvas`}
                    >
                      🎯 {id}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 text-center text-[11px] text-slate-500">
        Deterministic validation verified against Satisfactory 1.0 mechanics
      </div>
    </div>
  );
}
