"use client";

import React, { useState, useEffect } from "react";
import { SolveMode, ResourceInput, SolveResponse, CompareVariant, GameItem, GameRecipe } from "@/lib/types";
import { solveProduction, solveCompare, getItems, getRecipes } from "@/lib/api";
import BlueprintCanvas from "@/components/BlueprintCanvas";
import ShoppingList from "@/components/ShoppingList";
import ProductionTable from "@/components/ProductionTable";
import AltRecipePanel from "@/components/AltRecipePanel";
import ComparePanel from "@/components/ComparePanel";

const BELT_TIERS = [
  { tier: 1, name: "Mk.1", speed: 60 },
  { tier: 2, name: "Mk.2", speed: 120 },
  { tier: 3, name: "Mk.3", speed: 270 },
  { tier: 4, name: "Mk.4", speed: 480 },
  { tier: 5, name: "Mk.5", speed: 780 },
  { tier: 6, name: "Mk.6", speed: 1200 },
];

export default function Page() {
  const [mode, setMode] = useState<SolveMode>("resource_constrained");
  const [resources, setResources] = useState<ResourceInput[]>([
    { item_id: "iron_ore", display_name: "Iron Ore", rate: 0 },
    { item_id: "copper_ore", display_name: "Copper Ore", rate: 0 },
    { item_id: "limestone", display_name: "Limestone", rate: 0 },
    { item_id: "coal", display_name: "Coal", rate: 0 },
  ]);
  const [targetItems, setTargetItems] = useState<string[]>(["modular_frame"]);
  const [targetRates, setTargetRates] = useState<Record<string, number>>({ modular_frame: 0 });
  const [unlockedAlts, setUnlockedAlts] = useState<string[]>([]);
  
  // Belt constraint controls
  const [enforceBeltLimit, setEnforceBeltLimit] = useState(false);
  const [maxBeltTier, setMaxBeltTier] = useState<number>(3);

  const [result, setResult] = useState<SolveResponse | null>(null);
  const [compareVariants, setCompareVariants] = useState<CompareVariant[] | null>(null);
  const [selectedVariantLabel, setSelectedVariantLabel] = useState<string | null>(null);
  const [bestMachines, setBestMachines] = useState("");
  const [bestPower, setBestPower] = useState("");

  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<GameItem[]>([]);
  const [recipes, setRecipes] = useState<GameRecipe[]>([]);
  const [altPanelOpen, setAltPanelOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [loadedItems, loadedRecipes] = await Promise.all([getItems(), getRecipes()]);
        setItems(loadedItems);
        setRecipes(loadedRecipes);
      } catch (err) {
        console.error("Failed to load game data:", err);
      }
    }
    loadData();
  }, []);

  const handleSolve = async () => {
    setError(null);
    setCompareVariants(null);
    setSelectedVariantLabel(null);

    const activeResources = resources.filter((r) => r.rate > 0);
    const activeTargets = Object.entries(targetRates).filter(([_, rate]) => rate > 0);

    if (mode === "resource_constrained" && activeResources.length === 0) {
      setError("Please set at least one mining resource rate greater than 0/min.");
      return;
    }

    if (mode === "target_driven" && activeTargets.length === 0) {
      setError("Please set at least one target product rate greater than 0/min.");
      return;
    }

    setLoading(true);

    try {
      const resMap = Object.fromEntries(activeResources.map((r) => [r.item_id, r.rate]));
      const targetsMap = Object.fromEntries(activeTargets);
      const req = {
        mode,
        resources: resMap,
        targets: targetsMap,
        target_items: targetItems,
        unlocked_alts: unlockedAlts,
        max_belt_tier: enforceBeltLimit ? maxBeltTier : undefined,
      };

      const data = await solveProduction(req);
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    setError(null);

    const activeResources = resources.filter((r) => r.rate > 0);
    const activeTargets = Object.entries(targetRates).filter(([_, rate]) => rate > 0);

    if (mode === "resource_constrained" && activeResources.length === 0) {
      setError("Please set at least one mining resource rate greater than 0/min to compare.");
      return;
    }

    if (mode === "target_driven" && activeTargets.length === 0) {
      setError("Please set at least one target product rate greater than 0/min to compare.");
      return;
    }

    setComparing(true);

    try {
      const resMap = Object.fromEntries(activeResources.map((r) => [r.item_id, r.rate]));
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

  const toggleAlt = (recipeId: string) => {
    setUnlockedAlts(prev => 
      prev.includes(recipeId) ? prev.filter(id => id !== recipeId) : [...prev, recipeId]
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex justify-between items-center shrink-0">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          ⚙️ Satisfactory Factory Blueprint Builder
        </h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setAltPanelOpen(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded border border-slate-600 transition-colors text-sm font-medium"
          >
            Alt Recipes ({unlockedAlts.length} active)
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-80 bg-slate-900 border-r border-slate-700 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 space-y-6">
            
            {/* Mode Selector */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Mode</h3>
              <div className="flex bg-slate-800 rounded p-1 border border-slate-700">
                <button
                  className={`flex-1 py-1.5 text-sm rounded transition-colors ${mode === 'resource_constrained' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                  onClick={() => setMode('resource_constrained')}
                >
                  Max Output
                </button>
                <button
                  className={`flex-1 py-1.5 text-sm rounded transition-colors ${mode === 'target_driven' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                  onClick={() => setMode('target_driven')}
                >
                  Target Driven
                </button>
              </div>
            </div>

            {/* Target Products */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Target Products</h3>
              <div className="space-y-2">
                {targetItems.map(item => (
                  <div key={item} className="flex gap-2">
                    <select 
                      className="flex-1 bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-sky-500 outline-none"
                      value={item}
                      onChange={(e) => {
                        const newItems = targetItems.map(i => i === item ? e.target.value : i);
                        setTargetItems(newItems);
                        setTargetRates(prev => {
                          const newRates = { ...prev };
                          newRates[e.target.value] = prev[item] || 0;
                          delete newRates[item];
                          return newRates;
                        });
                      }}
                    >
                      {items.filter(i => !i.is_resource).map(i => (
                        <option key={i.id} value={i.id}>{i.display_name}</option>
                      ))}
                    </select>
                    {mode === 'target_driven' && (
                      <input 
                        type="number"
                        min="0"
                        placeholder="0"
                        className="w-20 bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white text-right focus:border-sky-500 outline-none"
                        value={targetRates[item] ?? 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setTargetRates(prev => ({ ...prev, [item]: Math.max(0, Number(e.target.value)) }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Available Mining Resources */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Available Resources (/min)</h3>
              <div className="space-y-2">
                {resources.map(res => (
                  <div key={res.item_id} className="flex justify-between items-center gap-2">
                    <label className="text-sm text-slate-300 capitalize">{res.display_name}</label>
                    <input 
                      type="number"
                      min="0"
                      placeholder="0"
                      className="w-24 bg-slate-800 border border-slate-700 rounded p-1.5 text-sm text-white text-right focus:border-sky-500 outline-none"
                      value={res.rate}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const newRate = Math.max(0, Number(e.target.value));
                        setResources(resources.map(r => r.item_id === res.item_id ? { ...r, rate: newRate } : r));
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Belt Constraints Toggle */}
            <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-200">Belt Tier Limit</div>
                  <div className="text-xs text-slate-400">Force parallel belts if flow exceeds cap</div>
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
                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between gap-2">
                  <label htmlFor="max-belt-select" className="text-xs text-slate-300">Max Unlocked Tier:</label>
                  <select 
                    id="max-belt-select"
                    value={maxBeltTier}
                    onChange={(e) => setMaxBeltTier(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-sky-400 font-mono focus:border-sky-500 outline-none cursor-pointer"
                  >
                    {BELT_TIERS.map(b => (
                      <option key={b.tier} value={b.tier}>
                        {b.name} ({b.speed}/min)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button 
                onClick={handleSolve}
                disabled={loading || comparing}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-emerald-950/40"
              >
                {loading ? 'Solving Optimal Plan...' : 'Solve Optimal Blueprint'}
              </button>
              <button 
                onClick={handleCompare}
                disabled={loading || comparing}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-sky-950/40"
              >
                {comparing ? 'Comparing Recipe Variants...' : 'Compare Alternate Recipes'}
              </button>
            </div>
            
            {error && <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 text-xs rounded">{error}</div>}
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col bg-slate-950 p-4 gap-4 overflow-hidden relative">
          
          <ComparePanel 
            variants={compareVariants} 
            isLoading={comparing} 
            onSelectVariant={selectVariant} 
            selectedLabel={selectedVariantLabel} 
            bestMachines={bestMachines} 
            bestPower={bestPower} 
          />
          
          <div className="flex-1 min-h-0 relative">
            <BlueprintCanvas result={result} isLoading={loading} items={items} />
          </div>

          <div className="h-64 overflow-y-auto shrink-0 pr-2">
            <ProductionTable steps={result?.steps || []} connections={result?.connections || []} />
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-[300px] bg-slate-900 border-l border-slate-700 overflow-y-auto shrink-0 p-4">
          <ShoppingList result={result} />
        </div>
      </div>

      <AltRecipePanel 
        recipes={recipes} 
        unlockedAlts={unlockedAlts} 
        onToggleAlt={toggleAlt} 
        isOpen={altPanelOpen} 
        onClose={() => setAltPanelOpen(false)} 
      />
    </div>
  );
}
