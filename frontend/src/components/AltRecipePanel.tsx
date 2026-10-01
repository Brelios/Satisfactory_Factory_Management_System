"use client";
import React from "react";
import type { GameRecipe } from "@/lib/types";

interface AltRecipePanelProps {
  recipes: GameRecipe[];
  unlockedAlts: string[];
  onToggleAlt: (recipeId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function AltRecipePanel({ recipes, unlockedAlts, onToggleAlt, isOpen, onClose }: AltRecipePanelProps) {
  if (!isOpen) return null;

  const alts = recipes.filter(r => r.is_alternate);
  
  // Group by first product
  const groupedAlts = alts.reduce((acc, recipe) => {
    const mainProduct = recipe.products[0]?.item_id || "unknown";
    if (!acc[mainProduct]) acc[mainProduct] = [];
    acc[mainProduct].push(recipe);
    return acc;
  }, {} as Record<string, GameRecipe[]>);

  return (
    <div className="fixed inset-y-0 left-0 w-96 bg-slate-900 border-r border-slate-700 shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white">Alternate Recipes</h2>
          <div className="text-xs text-sky-400">{unlockedAlts.length} enabled</div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-2 text-xl">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {Object.entries(groupedAlts).map(([product, groupRecipes]) => (
          <div key={product} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider capitalize border-b border-slate-800 pb-1">
              {product.replace(/_/g, ' ')}
            </h3>
            {groupRecipes.map(recipe => {
              const isEnabled = unlockedAlts.includes(recipe.id);
              return (
                <div 
                  key={recipe.id} 
                  className={`p-3 rounded-lg border ${isEnabled ? 'bg-sky-900/20 border-sky-700' : 'bg-slate-800 border-slate-700'} transition-colors cursor-pointer hover:border-sky-500`}
                  onClick={() => onToggleAlt(recipe.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-slate-200 text-sm leading-tight">{recipe.display_name}</div>
                    <div className={`w-8 h-4 rounded-full flex items-center p-0.5 ${isEnabled ? 'bg-sky-500' : 'bg-slate-600'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${isEnabled ? 'translate-x-4' : ''}`} />
                    </div>
                  </div>
                  
                  <div className="text-xs text-slate-400 mb-2 capitalize">{recipe.machine.replace(/_/g, ' ')} &middot; {recipe.duration}s</div>
                  
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex-1 space-y-1">
                      {recipe.ingredients.map(ing => (
                        <div key={ing.item_id} className="text-amber-400">
                          {ing.amount} &times; {ing.item_id.replace(/_/g, ' ')}
                        </div>
                      ))}
                    </div>
                    <div className="text-slate-500">→</div>
                    <div className="flex-1 space-y-1">
                      {recipe.products.map(prod => (
                        <div key={prod.item_id} className="text-emerald-400 font-medium">
                          {prod.amount} &times; {prod.item_id.replace(/_/g, ' ')}
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
  );
}
