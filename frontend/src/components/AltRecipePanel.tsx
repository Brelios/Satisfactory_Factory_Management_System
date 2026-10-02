"use client";
import React, { useState, useEffect } from "react";
import type { GameRecipe } from "@/lib/types";
import { formatItemName } from "@/lib/colors";

interface AltRecipePanelProps {
  recipes: GameRecipe[];
  unlockedAlts: string[];
  onToggleAlt: (recipeId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onSetAllAlts?: (recipeIds: string[]) => void;
}

export default function AltRecipePanel({
  recipes,
  unlockedAlts,
  onToggleAlt,
  isOpen,
  onClose,
  onSetAllAlts,
}: AltRecipePanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const alts = recipes.filter((r) => r.is_alternate);

  // Filter by search
  const filteredAlts = alts.filter((r) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const nameMatch = r.display_name.toLowerCase().includes(query);
    const productMatch = r.products.some((p) =>
      p.item_id.toLowerCase().includes(query)
    );
    const ingredientMatch = r.ingredients.some((i) =>
      i.item_id.toLowerCase().includes(query)
    );
    return nameMatch || productMatch || ingredientMatch;
  });

  // Group by first product
  const groupedAlts = filteredAlts.reduce((acc, recipe) => {
    const mainProduct = recipe.products[0]?.item_id || "unknown";
    if (!acc[mainProduct]) acc[mainProduct] = [];
    acc[mainProduct].push(recipe);
    return acc;
  }, {} as Record<string, GameRecipe[]>);

  const handleEnableAll = () => {
    if (onSetAllAlts) {
      onSetAllAlts(alts.map((r) => r.id));
    } else {
      alts.forEach((r) => {
        if (!unlockedAlts.includes(r.id)) onToggleAlt(r.id);
      });
    }
  };

  const handleDisableAll = () => {
    if (onSetAllAlts) {
      onSetAllAlts([]);
    } else {
      unlockedAlts.forEach((id) => onToggleAlt(id));
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-[420px] bg-slate-900 border-r border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/90 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🧪</span>
                <span>Alternate Recipes</span>
              </h2>
              <div className="text-xs text-sky-400 font-medium mt-0.5">
                {unlockedAlts.length} of {alts.length} recipes enabled
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 text-lg leading-none transition-colors"
              title="Close (Esc)"
              aria-label="Close alternate recipes drawer"
            >
              &times;
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="Search recipes, products, ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 outline-none font-sans"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-0.5">
            <button
              onClick={handleEnableAll}
              className="flex-1 py-1 px-2.5 bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-600 transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={handleDisableAll}
              className="flex-1 py-1 px-2.5 bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-600 transition-colors"
            >
              Disable All
            </button>
          </div>
        </div>

        {/* Recipe List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {Object.entries(groupedAlts).length > 0 ? (
            Object.entries(groupedAlts).map(([product, groupRecipes]) => (
              <div key={product} className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1">
                  {formatItemName(product)}
                </h3>
                {groupRecipes.map((recipe) => {
                  const isEnabled = unlockedAlts.includes(recipe.id);
                  return (
                    <div
                      key={recipe.id}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isEnabled
                          ? "bg-sky-950/40 border-sky-600 shadow-md shadow-sky-950/30"
                          : "bg-slate-800/80 border-slate-700/80 hover:border-slate-500"
                      }`}
                      onClick={() => onToggleAlt(recipe.id)}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="font-semibold text-slate-100 text-xs leading-tight">
                          {recipe.display_name}
                        </div>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => {}} // handled by parent div onClick
                          className="w-4 h-4 rounded text-sky-600 bg-slate-700 border-slate-600 cursor-pointer pointer-events-none"
                        />
                      </div>

                      <div className="text-[10.5px] text-slate-400 mb-2 capitalize">
                        {recipe.machine.replace(/_/g, " ")} &middot; {recipe.duration}s
                      </div>

                      <div className="flex items-center gap-2 text-xs bg-slate-950/60 p-2 rounded-lg border border-slate-800 font-mono text-[11px]">
                        <div className="flex-1 space-y-0.5">
                          {recipe.ingredients.map((ing) => (
                            <div key={ing.item_id} className="text-amber-400 truncate">
                              {ing.amount} &times; {formatItemName(ing.item_id)}
                            </div>
                          ))}
                        </div>
                        <div className="text-slate-500 text-sm">→</div>
                        <div className="flex-1 space-y-0.5">
                          {recipe.products.map((prod) => (
                            <div key={prod.item_id} className="text-emerald-400 font-medium truncate">
                              {prod.amount} &times; {formatItemName(prod.item_id)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              No alternate recipes matching &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>
      </div>
    </>
  );
}
