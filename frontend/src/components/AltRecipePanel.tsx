"use client";
import React, { useEffect } from "react";
import type { GameRecipe } from "@/lib/types";

interface AltRecipePanelProps {
  recipes: GameRecipe[];
  unlockedAlts: string[];
  onToggleAlt: (recipeId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function AltRecipePanel({
  recipes,
  unlockedAlts,
  onToggleAlt,
  isOpen,
  onClose,
}: AltRecipePanelProps) {
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

  // Group by first product
  const groupedAlts = alts.reduce((acc, recipe) => {
    const mainProduct = recipe.products[0]?.item_id || "unknown";
    if (!acc[mainProduct]) acc[mainProduct] = [];
    acc[mainProduct].push(recipe);
    return acc;
  }, {} as Record<string, GameRecipe[]>);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-96 bg-slate-900 border-r border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-left duration-200">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/90">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🧪</span>
              <span>Alternate Recipes</span>
            </h2>
            <div className="text-xs text-sky-400 font-medium mt-0.5">
              {unlockedAlts.length} active
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 text-lg leading-none transition-colors"
            title="Close (Esc)"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {Object.entries(groupedAlts).map(([product, groupRecipes]) => (
            <div key={product} className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider capitalize border-b border-slate-800 pb-1">
                {product.replace(/_/g, " ")}
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
                      <div className="font-semibold text-slate-100 text-sm leading-tight">
                        {recipe.display_name}
                      </div>
                      <div
                        className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors shrink-0 ${
                          isEnabled ? "bg-sky-500" : "bg-slate-600"
                        }`}
                      >
                        <div
                          className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                            isEnabled ? "translate-x-4" : ""
                          }`}
                        />
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 mb-2 capitalize">
                      {recipe.machine.replace(/_/g, " ")} &middot; {recipe.duration}s
                    </div>

                    <div className="flex items-center gap-2 text-xs bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div className="flex-1 space-y-0.5">
                        {recipe.ingredients.map((ing) => (
                          <div key={ing.item_id} className="text-amber-400 font-mono text-[11px]">
                            {ing.amount} &times; {ing.item_id.replace(/_/g, " ")}
                          </div>
                        ))}
                      </div>
                      <div className="text-slate-500 text-sm">→</div>
                      <div className="flex-1 space-y-0.5">
                        {recipe.products.map((prod) => (
                          <div key={prod.item_id} className="text-emerald-400 font-mono font-medium text-[11px]">
                            {prod.amount} &times; {prod.item_id.replace(/_/g, " ")}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
