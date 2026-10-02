"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  SolveMode,
  ResourceInput,
  SolveResponse,
  CompareVariant,
  GameItem,
  GameRecipe,
} from "@/lib/types";
import { solveProduction, solveCompare, getItems, getRecipes } from "@/lib/api";
import BlueprintCanvas from "@/components/BlueprintCanvas";
import ShoppingList from "@/components/ShoppingList";
import ProductionTable from "@/components/ProductionTable";
import AltRecipePanel from "@/components/AltRecipePanel";
import ComparePanel from "@/components/ComparePanel";
import { FACTORY_PRESETS, type FactoryPreset } from "@/lib/presets";
import {
  generateShareUrl,
  deserializePlan,
  savePlanToLocalStorage,
  loadPlanFromLocalStorage,
  type FactoryShareState,
} from "@/lib/share";
import { getItemColor, formatItemName } from "@/lib/colors";

const BELT_TIERS = [
  { tier: 1, name: "Mk.1", speed: 60 },
  { tier: 2, name: "Mk.2", speed: 120 },
  { tier: 3, name: "Mk.3", speed: 270 },
  { tier: 4, name: "Mk.4", speed: 480 },
  { tier: 5, name: "Mk.5", speed: 780 },
  { tier: 6, name: "Mk.6", speed: 1200 },
];

const DEFAULT_RESOURCES: ResourceInput[] = [
  { item_id: "iron_ore", display_name: "Iron Ore", rate: 0 },
  { item_id: "copper_ore", display_name: "Copper Ore", rate: 0 },
  { item_id: "limestone", display_name: "Limestone", rate: 0 },
  { item_id: "coal", display_name: "Coal", rate: 0 },
];

export default function Page() {
  const [mode, setMode] = useState<SolveMode>("resource_constrained");
  const [resources, setResources] = useState<ResourceInput[]>(DEFAULT_RESOURCES);
  const [targetItems, setTargetItems] = useState<string[]>(["modular_frame"]);
  const [targetRates, setTargetRates] = useState<Record<string, number>>({
    modular_frame: 0,
  });
  const [unlockedAlts, setUnlockedAlts] = useState<string[]>([]);

  // Belt constraint controls
  const [enforceBeltLimit, setEnforceBeltLimit] = useState(false);
  const [maxBeltTier, setMaxBeltTier] = useState<number>(3);

  const [result, setResult] = useState<SolveResponse | null>(null);
  const [compareVariants, setCompareVariants] = useState<CompareVariant[] | null>(
    null
  );
  const [selectedVariantLabel, setSelectedVariantLabel] = useState<string | null>(
    null
  );
  const [bestMachines, setBestMachines] = useState("");
  const [bestPower, setBestPower] = useState("");

  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState(false);

  const [items, setItems] = useState<GameItem[]>([]);
  const [recipes, setRecipes] = useState<GameRecipe[]>([]);
  const [altPanelOpen, setAltPanelOpen] = useState(false);

  const initialLoadedRef = useRef(false);

  // Helper to execute solve with given state
  const executeSolve = useCallback(
    async (
      currentMode: SolveMode,
      currentResources: ResourceInput[],
      currentTargets: Record<string, number>,
      currentTargetItems: string[],
      currentAlts: string[],
      currentEnforceBelt: boolean,
      currentMaxBelt: number
    ) => {
      setError(null);
      setCompareVariants(null);
      setSelectedVariantLabel(null);

      const activeResources = currentResources.filter((r) => r.rate > 0);
      const activeTargets = Object.entries(currentTargets).filter(
        ([_, rate]) => rate > 0
      );

      if (currentMode === "resource_constrained" && activeResources.length === 0) {
        setError("Please set at least one mining resource rate greater than 0/min.");
        return;
      }

      if (currentMode === "target_driven" && activeTargets.length === 0) {
        setError("Please set at least one target product rate greater than 0/min.");
        return;
      }

      setLoading(true);

      try {
        const resMap = Object.fromEntries(
          activeResources.map((r) => [r.item_id, r.rate])
        );
        const targetsMap = Object.fromEntries(activeTargets);
        const req = {
          mode: currentMode,
          resources: resMap,
          targets: targetsMap,
          target_items: currentTargetItems,
          unlocked_alts: currentAlts,
          max_belt_tier: currentEnforceBelt ? currentMaxBelt : undefined,
        };

        const data = await solveProduction(req);
        setResult(data);

        // Auto-save plan to localStorage
        savePlanToLocalStorage({
          mode: currentMode,
          resources: currentResources.map((r) => ({
            item_id: r.item_id,
            rate: r.rate,
          })),
          targetItems: currentTargetItems,
          targetRates: currentTargets,
          unlockedAlts: currentAlts,
          enforceBeltLimit: currentEnforceBelt,
          maxBeltTier: currentMaxBelt,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load items, recipes, and check URL params on initial mount
  useEffect(() => {
    async function loadData() {
      try {
        const [loadedItems, loadedRecipes] = await Promise.all([
          getItems(),
          getRecipes(),
        ]);
        setItems(loadedItems);
        setRecipes(loadedRecipes);

        // Check URL search params for shared plan
        if (!initialLoadedRef.current && typeof window !== "undefined") {
          initialLoadedRef.current = true;
          const searchParams = new URLSearchParams(window.location.search);
          const planCode = searchParams.get("plan");

          let loadedPlan: FactoryShareState | null = null;
          if (planCode) {
            loadedPlan = deserializePlan(planCode);
          } else {
            loadedPlan = loadPlanFromLocalStorage();
          }

          if (loadedPlan) {
            setMode(loadedPlan.mode);
            setUnlockedAlts(loadedPlan.unlockedAlts || []);
            setTargetItems(loadedPlan.targetItems || ["modular_frame"]);
            setTargetRates(loadedPlan.targetRates || {});
            setEnforceBeltLimit(Boolean(loadedPlan.enforceBeltLimit));
            setMaxBeltTier(loadedPlan.maxBeltTier || 3);

            // Reconstruct resource inputs with display names
            const restoredResources: ResourceInput[] = (
              loadedPlan.resources || []
            ).map((r) => ({
              item_id: r.item_id,
              display_name: formatItemName(r.item_id),
              rate: r.rate,
            }));
            setResources(
              restoredResources.length > 0
                ? restoredResources
                : DEFAULT_RESOURCES
            );

            // Trigger auto-solve for the loaded plan
            executeSolve(
              loadedPlan.mode,
              restoredResources.length > 0
                ? restoredResources
                : DEFAULT_RESOURCES,
              loadedPlan.targetRates || {},
              loadedPlan.targetItems || ["modular_frame"],
              loadedPlan.unlockedAlts || [],
              Boolean(loadedPlan.enforceBeltLimit),
              loadedPlan.maxBeltTier || 3
            );
          }
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    }
    loadData();
  }, [executeSolve]);

  const handleSolve = () => {
    executeSolve(
      mode,
      resources,
      targetRates,
      targetItems,
      unlockedAlts,
      enforceBeltLimit,
      maxBeltTier
    );
  };

  const handleCompare = async () => {
    setError(null);

    const activeResources = resources.filter((r) => r.rate > 0);
    const activeTargets = Object.entries(targetRates).filter(
      ([_, rate]) => rate > 0
    );

    if (mode === "resource_constrained" && activeResources.length === 0) {
      setError(
        "Please set at least one mining resource rate greater than 0/min to compare."
      );
      return;
    }

    if (mode === "target_driven" && activeTargets.length === 0) {
      setError(
        "Please set at least one target product rate greater than 0/min to compare."
      );
      return;
    }

    setComparing(true);

    try {
      const resMap = Object.fromEntries(
        activeResources.map((r) => [r.item_id, r.rate])
      );
      const targetsMap = Object.fromEntries(activeTargets);
      const req = {
        mode,
        resources: resMap,
        targets: targetsMap,
        target_items: targetItems,
        unlocked_alts: unlockedAlts,
        max_belt_tier: enforceBeltLimit ? maxBeltTier : undefined,
      };

      const data = await solveCompare(req);
      setCompareVariants(data.variants);
      setBestMachines(data.best_machines);
      setBestPower(data.best_power);

      if (data.variants.length > 0) {
        selectVariant(data.variants[0]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setComparing(false);
    }
  };

  const selectVariant = (variant: CompareVariant) => {
    setSelectedVariantLabel(variant.label);
    setResult({
      steps: variant.steps,
      connections: variant.connections,
      blueprint_svg: variant.blueprint_svg,
      total_machines: variant.total_machines,
      total_power_mw: variant.total_power_mw,
      target_outputs: variant.target_outputs,
      resource_usage: variant.resource_usage,
      shopping_list: variant.shopping_list,
    });
  };

  const applyPreset = (preset: FactoryPreset) => {
    setMode(preset.mode);
    setTargetItems(preset.targetItems);
    setTargetRates(preset.targetRates);
    setUnlockedAlts(preset.unlockedAlts || []);

    const updatedRes = preset.resources.map((r) => ({
      item_id: r.item_id,
      display_name: formatItemName(r.item_id),
      rate: r.rate,
    }));
    setResources(updatedRes);

    executeSolve(
      preset.mode,
      updatedRes,
      preset.targetRates,
      preset.targetItems,
      preset.unlockedAlts || [],
      enforceBeltLimit,
      preset.maxBeltTier || maxBeltTier
    );
  };

  const handleSharePlan = () => {
    const shareUrl = generateShareUrl({
      mode,
      resources: resources.map((r) => ({ item_id: r.item_id, rate: r.rate })),
      targetItems,
      targetRates,
      unlockedAlts,
      enforceBeltLimit,
      maxBeltTier,
    });

    if (navigator?.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setShareToast(true);
        setTimeout(() => setShareToast(false), 3000);
      });
    }
  };

  const toggleAlt = (recipeId: string) => {
    setUnlockedAlts((prev) =>
      prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId]
    );
  };

  // Add an unlisted resource from available game items
  const availableResourcesList = items.filter((i) => i.is_resource);
  const unselectedResources = availableResourcesList.filter(
    (ar) => !resources.some((r) => r.item_id === ar.id)
  );

  const addResource = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setResources((prev) => [
      ...prev,
      {
        item_id: item.id,
        display_name: item.display_name,
        rate: 0,
      },
    ]);
  };

  const removeResource = (itemId: string) => {
    setResources((prev) => prev.filter((r) => r.item_id !== itemId));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-200">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-700/80 px-6 py-3.5 flex justify-between items-center shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">
              Satisfactory Factory Management System
            </h1>
            <div className="text-[11px] text-slate-400">
              Optimal schematic layout &amp; logistics calculator
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Preset Selector */}
          <select
            onChange={(e) => {
              const preset = FACTORY_PRESETS.find((p) => p.id === e.target.value);
              if (preset) applyPreset(preset);
            }}
            value=""
            className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-sky-500 outline-none cursor-pointer transition-colors"
          >
            <option value="" disabled>
              ⚡ Quick Presets...
            </option>
            {FACTORY_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>

          {/* Share Plan Button */}
          <button
            onClick={handleSharePlan}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 text-xs font-semibold transition-all shadow-sm active:scale-95"
            title="Generate shareable URL link for this factory plan"
          >
            <span>🔗</span>
            <span>Share Plan</span>
          </button>

          {/* Alt Recipes Button */}
          <button
            onClick={() => setAltPanelOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-sky-950/70 hover:bg-sky-900/90 text-sky-300 font-semibold rounded-lg border border-sky-600/80 text-xs transition-all shadow-md active:scale-95"
          >
            <span>🧪</span>
            <span>Alt Recipes</span>
            <span className="bg-sky-500 text-white text-[10px] font-mono px-2 py-0.5 rounded-full">
              {unlockedAlts.length} active
            </span>
          </button>
        </div>
      </header>

      {/* Share Toast Banner */}
      {shareToast && (
        <div className="bg-emerald-600 text-white text-xs font-mono py-1.5 text-center animate-in fade-in duration-200 font-medium">
          ✓ Shareable link copied to clipboard! Paste it to share your factory plan.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Input Configuration Panel */}
        <div className="w-80 bg-slate-900 border-r border-slate-700/80 flex flex-col shrink-0 overflow-y-auto select-none">
          <div className="p-4 space-y-5">
            {/* Mode Selector */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Optimization Mode
              </h3>
              <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                <button
                  className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${
                    mode === "resource_constrained"
                      ? "bg-sky-600 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                  onClick={() => setMode("resource_constrained")}
                >
                  Max Output
                </button>
                <button
                  className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${
                    mode === "target_driven"
                      ? "bg-sky-600 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                  onClick={() => setMode("target_driven")}
                >
                  Target Quota
                </button>
              </div>
            </div>

            {/* Target Products */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Target Products
              </h3>
              <div className="space-y-2">
                {targetItems.map((item) => (
                  <div key={item} className="flex gap-2 items-center">
                    <select
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-sky-500 outline-none truncate"
                      value={item}
                      onChange={(e) => {
                        const newItems = targetItems.map((i) =>
                          i === item ? e.target.value : i
                        );
                        setTargetItems(newItems);
                        setTargetRates((prev) => {
                          const newRates = { ...prev };
                          newRates[e.target.value] = prev[item] || 0;
                          delete newRates[item];
                          return newRates;
                        });
                      }}
                    >
                      {items
                        .filter((i) => !i.is_resource)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.display_name}
                          </option>
                        ))}
                    </select>

                    {mode === "target_driven" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="100000"
                          placeholder="0"
                          className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right focus:border-sky-500 outline-none font-mono font-medium"
                          value={targetRates[item] ?? 0}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            setTargetRates((prev) => ({
                              ...prev,
                              [item]: Math.max(0, Number(e.target.value)),
                            }))
                          }
                        />
                        <span className="text-[10px] text-slate-500 font-mono">/m</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Available Mining Resources */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Available Resources (/min)
                </h3>
              </div>

              <div className="space-y-1.5">
                {resources.map((res) => (
                  <div
                    key={res.item_id}
                    className="flex justify-between items-center gap-2 bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-800/80"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getItemColor(res.item_id) }}
                      />
                      <label className="text-xs text-slate-200 capitalize truncate" title={res.display_name}>
                        {res.display_name}
                      </label>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="100000"
                        placeholder="0"
                        className="w-20 bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-white text-right focus:border-sky-500 outline-none font-mono"
                        value={res.rate}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const newRate = Math.max(0, Number(e.target.value));
                          setResources(
                            resources.map((r) =>
                              r.item_id === res.item_id ? { ...r, rate: newRate } : r
                            )
                          );
                        }}
                      />
                      {resources.length > 1 && (
                        <button
                          onClick={() => removeResource(res.item_id)}
                          className="text-slate-500 hover:text-red-400 text-xs px-1"
                          title="Remove resource"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Resource Dropdown */}
              {unselectedResources.length > 0 && (
                <div className="mt-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addResource(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    value=""
                    className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs focus:border-sky-500 outline-none cursor-pointer"
                  >
                    <option value="" disabled>
                      + Add Raw Ore / Resource...
                    </option>
                    {unselectedResources.map((ur) => (
                      <option key={ur.id} value={ur.id}>
                        {ur.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Belt Constraints Toggle */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    Belt Throughput Constraint
                  </div>
                  <div className="text-[10.5px] text-slate-400">
                    Split excess flow into parallel belts
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="belt-limit-toggle"
                  checked={enforceBeltLimit}
                  onChange={(e) => setEnforceBeltLimit(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 bg-slate-700 border-slate-600 cursor-pointer"
                />
              </div>

              {enforceBeltLimit && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <label htmlFor="max-belt-select" className="text-xs text-slate-300">
                    Max Unlocked Tier:
                  </label>
                  <select
                    id="max-belt-select"
                    value={maxBeltTier}
                    onChange={(e) => setMaxBeltTier(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-sky-400 font-mono focus:border-sky-500 outline-none cursor-pointer"
                  >
                    {BELT_TIERS.map((b) => (
                      <option key={b.tier} value={b.tier}>
                        {b.name} ({b.speed}/min)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-1 space-y-2">
              <button
                onClick={handleSolve}
                disabled={loading || comparing}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-emerald-950/40 active:scale-98"
              >
                {loading ? "Solving Optimal Plan..." : "Solve Optimal Blueprint"}
              </button>
              <button
                onClick={handleCompare}
                disabled={loading || comparing}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-sky-950/40 active:scale-98"
              >
                {comparing ? "Comparing Recipe Variants..." : "Compare Alternate Recipes"}
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 text-red-200 text-xs rounded-xl font-mono leading-relaxed">
                ⚠️ {error}
              </div>
            )}
          </div>
        </div>

        {/* Main Canvas & Inspection Area */}
        <div className="flex-1 flex flex-col bg-slate-950 p-4 gap-3.5 overflow-hidden relative">
          <ComparePanel
            variants={compareVariants}
            isLoading={comparing}
            onSelectVariant={selectVariant}
            selectedLabel={selectedVariantLabel}
            bestMachines={bestMachines}
            bestPower={bestPower}
          />

          <div className="flex-1 min-h-0 relative">
            <BlueprintCanvas
              result={result}
              isLoading={loading}
              items={items}
              onSelectPreset={applyPreset}
            />
          </div>

          <div className="h-64 overflow-y-auto shrink-0 pr-1">
            <ProductionTable
              steps={result?.steps || []}
              connections={result?.connections || []}
            />
          </div>
        </div>

        {/* Right Dashboard / Logistics Summary Panel */}
        <div className="w-[320px] bg-slate-900 border-l border-slate-700/80 overflow-y-auto shrink-0 p-4">
          <ShoppingList result={result} />
        </div>
      </div>

      {/* Alternate Recipes Drawer Modal */}
      <AltRecipePanel
        recipes={recipes}
        unlockedAlts={unlockedAlts}
        onToggleAlt={toggleAlt}
        onSetAllAlts={(ids) => setUnlockedAlts(ids)}
        isOpen={altPanelOpen}
        onClose={() => setAltPanelOpen(false)}
      />
    </div>
  );
}
