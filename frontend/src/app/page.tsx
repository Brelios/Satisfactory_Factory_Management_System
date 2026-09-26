"use client";

import { useState, useEffect } from "react";
import { 
  SolveMode, 
  ResourceInput, 
  SolveRequest, 
  SolveResponse, 
  GameItem, 
  GameRecipe 
} from "@/lib/types";
import { solveProduction, getItems, getRecipes } from "@/lib/api";

export default function Page() {
  const [mode, setMode] = useState<SolveMode>("resource_constrained");

  // Resource inputs
  const [resources, setResources] = useState<ResourceInput[]>([
    { item_id: "iron_ore", display_name: "Iron Ore", rate: 720 },
    { item_id: "copper_ore", display_name: "Copper Ore", rate: 0 },
    { item_id: "limestone", display_name: "Limestone", rate: 0 },
    { item_id: "coal", display_name: "Coal", rate: 0 },
  ]);

  // Target items (for resource_constrained)
  const [targetItems, setTargetItems] = useState<string[]>(["modular_frame"]);

  // Target rates (for target_driven)
  const [targetRates, setTargetRates] = useState<Record<string, number>>({ modular_frame: 10 });

  const [unlockedAlts, setUnlockedAlts] = useState<string[]>([]);
  const [result, setResult] = useState<SolveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<GameItem[]>([]);
  const [recipes, setRecipes] = useState<GameRecipe[]>([]);

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

  async function handleSolve() {
    setLoading(true);
    setError(null);
    try {
      const req: SolveRequest = mode === "resource_constrained" 
        ? {
            mode: "resource_constrained",
            resources: Object.fromEntries(
              resources.filter(r => r.rate > 0).map(r => [r.item_id, r.rate])
            ),
            target_items: targetItems,
            unlocked_alts: unlockedAlts,
            optimization: "maximize_output",
          }
        : {
            mode: "target_driven",
            targets: targetRates,
            unlocked_alts: unlockedAlts,
            optimization: "maximize_output",
          };
      const data = await solveProduction(req);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const updateResource = (idx: number, rate: number) => {
    const newResources = [...resources];
    newResources[idx].rate = rate;
    setResources(newResources);
  };

  const addResource = () => {
    setResources([...resources, { item_id: "", display_name: "Select item...", rate: 0 }]);
  };

  const removeResource = (idx: number) => {
    setResources(resources.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden text-slate-300 blueprint-grid">
      {/* Header */}
      <header className="flex-none p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between shadow-md z-10">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <span>⚙️</span> Satisfactory Factory Blueprint Builder
        </h1>
        <div className="text-sm text-slate-400">v1.0</div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Panel */}
        <aside className="w-80 flex-none bg-slate-900/90 border-r border-slate-700 p-4 flex flex-col gap-6 overflow-y-auto z-10 backdrop-blur-sm">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Mode</h2>
            <div className="flex p-1 bg-slate-800 rounded-lg">
              <button 
                className={`flex-1 py-1 px-2 text-sm rounded ${mode === "resource_constrained" ? "bg-sky-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
                onClick={() => setMode("resource_constrained")}
              >
                Max Output
              </button>
              <button 
                className={`flex-1 py-1 px-2 text-sm rounded ${mode === "target_driven" ? "bg-sky-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
                onClick={() => setMode("target_driven")}
              >
                Target Driven
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              {mode === "resource_constrained" ? "Available Resources" : "Target Items"}
            </h2>
            
            {mode === "resource_constrained" ? (
              <div className="flex flex-col gap-2">
                {resources.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select 
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-sky-500"
                      value={r.item_id}
                      onChange={e => {
                        const newResources = [...resources];
                        newResources[idx].item_id = e.target.value;
                        const item = items.find(i => i.id === e.target.value);
                        if (item) newResources[idx].display_name = item.display_name;
                        setResources(newResources);
                      }}
                    >
                      <option value="">Select...</option>
                      {items.filter(i => i.is_resource).map(item => (
                        <option key={item.id} value={item.id}>{item.display_name}</option>
                      ))}
                    </select>
                    <input 
                      type="number" 
                      className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-sky-500"
                      value={r.rate}
                      onChange={e => updateResource(idx, Number(e.target.value))}
                    />
                    <button 
                      className="text-slate-500 hover:text-red-400"
                      onClick={() => removeResource(idx)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button 
                  className="text-sm text-sky-400 hover:text-sky-300 text-left"
                  onClick={addResource}
                >
                  + Add Resource
                </button>

                <div className="mt-4 flex flex-col gap-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase">Maximize Production Of:</h3>
                  {targetItems.map((targetId, idx) => (
                    <div key={idx} className="flex gap-2">
                      <select 
                        className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-sky-500"
                        value={targetId}
                        onChange={e => {
                          const newTargets = [...targetItems];
                          newTargets[idx] = e.target.value;
                          setTargetItems(newTargets);
                        }}
                      >
                        {items.filter(i => !i.is_resource).map(item => (
                          <option key={item.id} value={item.id}>{item.display_name}</option>
                        ))}
                      </select>
                      <button 
                        className="text-slate-500 hover:text-red-400"
                        onClick={() => setTargetItems(targetItems.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button 
                    className="text-xs text-sky-400 hover:text-sky-300 text-left"
                    onClick={() => setTargetItems([...targetItems, items[0]?.id || ""])}
                  >
                    + Add Target
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {Object.entries(targetRates).map(([itemId, rate]) => (
                  <div key={itemId} className="flex items-center gap-2">
                    <select 
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-sky-500"
                      value={itemId}
                      onChange={e => {
                        const newRates = { ...targetRates };
                        delete newRates[itemId];
                        newRates[e.target.value] = rate;
                        setTargetRates(newRates);
                      }}
                    >
                      {items.filter(i => !i.is_resource).map(item => (
                        <option key={item.id} value={item.id}>{item.display_name}</option>
                      ))}
                    </select>
                    <input 
                      type="number" 
                      className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-sky-500"
                      value={rate}
                      onChange={e => setTargetRates({ ...targetRates, [itemId]: Number(e.target.value) })}
                    />
                    <button 
                      className="text-slate-500 hover:text-red-400"
                      onClick={() => {
                        const newRates = { ...targetRates };
                        delete newRates[itemId];
                        setTargetRates(newRates);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button 
                  className="text-sm text-sky-400 hover:text-sky-300 text-left"
                  onClick={() => setTargetRates({ ...targetRates, [items[0]?.id || "iron_plate"]: 10 })}
                >
                  + Add Target Rate
                </button>
              </div>
            )}
          </div>

          <button 
            className={`mt-4 py-2 px-4 rounded font-medium text-white transition-all shadow-lg ${loading ? 'bg-sky-800 cursor-not-allowed animate-pulse' : 'bg-sky-600 hover:bg-sky-500 hover:shadow-sky-500/20'}`}
            onClick={handleSolve}
            disabled={loading}
          >
            {loading ? "Calculating..." : "SOLVE BLUEPRINT"}
          </button>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded text-red-400 text-xs break-words">
              {error}
            </div>
          )}
        </aside>

        {/* Center Viewer */}
        <main className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
          {result?.blueprint_svg ? (
            <div 
              className="w-full h-full p-4 overflow-auto bg-transparent flex items-center justify-center cursor-move"
              dangerouslySetInnerHTML={{ __html: result.blueprint_svg }}
            />
          ) : (
            <div className="text-slate-600 flex flex-col items-center gap-4">
              <span className="text-4xl">🏗️</span>
              <p>Configure inputs and click Solve to generate blueprint</p>
            </div>
          )}
        </main>

        {/* Right Panel */}
        <aside className="w-[300px] flex-none bg-slate-900/90 border-l border-slate-700 p-4 flex flex-col gap-6 overflow-y-auto z-10 backdrop-blur-sm">
          {result ? (
            <>
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Power & Stats</h2>
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Power</span>
                    <span className="text-amber-400 font-mono font-medium">{result.total_power_mw.toFixed(1)} MW</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Machines</span>
                    <span className="text-sky-400 font-mono font-medium">{result.total_machines}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-emerald-500 uppercase tracking-wider">Output</h2>
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex flex-col gap-2">
                  {Object.entries(result.target_outputs).map(([item, rate]) => (
                    <div key={item} className="flex justify-between items-center">
                      <span className="text-slate-300">{items.find(i => i.id === item)?.display_name || item}</span>
                      <span className="text-emerald-400 font-mono">{rate.toFixed(1)} /min</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-amber-500 uppercase tracking-wider">Resource Usage</h2>
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex flex-col gap-2">
                  {Object.entries(result.resource_usage).map(([item, rate]) => (
                    <div key={item} className="flex justify-between items-center">
                      <span className="text-slate-300">{items.find(i => i.id === item)?.display_name || item}</span>
                      <span className="text-amber-400 font-mono">{rate.toFixed(1)} /min</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Shopping List</h2>
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex flex-col gap-2 overflow-y-auto">
                  {Object.entries(result.shopping_list || {}).map(([item, count]) => (
                    <div key={item} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">{items.find(i => i.id === item)?.display_name || item}</span>
                      <span className="text-slate-400 font-mono">x{count}</span>
                    </div>
                  ))}
                  {Object.keys(result.shopping_list || {}).length === 0 && (
                    <span className="text-slate-500 text-sm">No buildings required</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-slate-600 text-sm text-center mt-10">
              Run solver to see stats and shopping list
            </div>
          )}
        </aside>
      </div>

      {/* Footer Table */}
      <footer className="flex-none h-64 bg-slate-900 border-t border-slate-700 p-0 overflow-hidden flex flex-col z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="p-2 px-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Production Steps</h2>
        </div>
        <div className="flex-1 overflow-auto bg-slate-950 p-4">
          {result?.steps ? (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase text-slate-500 bg-slate-900/50">
                <tr>
                  <th className="px-4 py-2 font-medium">Machine</th>
                  <th className="px-4 py-2 font-medium">Recipe</th>
                  <th className="px-4 py-2 font-medium">Count</th>
                  <th className="px-4 py-2 font-medium">Clock Speed</th>
                  <th className="px-4 py-2 font-medium">Power</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {result.steps.map(step => (
                  <tr key={step.step_id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">{step.machine}</td>
                    <td className="px-4 py-3 text-sky-400">{step.recipe_name}</td>
                    <td className="px-4 py-3 font-mono">{step.machine_count}</td>
                    <td className="px-4 py-3 font-mono">{step.clock_speed.toFixed(0)}%</td>
                    <td className="px-4 py-3 font-mono text-amber-400">{step.power_mw.toFixed(1)} MW</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-600 text-sm">
              Waiting for results...
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
