/**
 * Satisfactory Factory Management System
 * Item color mapping, resource value weights, and formatting utilities.
 */

export const ITEM_COLORS: Record<string, string> = {
  // Ores & Raw Materials
  iron_ore: "#94a3b8", // Slate 400 (raw mineral gray - distinct from all refined metals)
  copper_ore: "#f97316", // Orange 500
  coal: "#475569", // Slate 600
  limestone: "#eab308", // Yellow 500
  raw_quartz: "#f43f5e", // Rose 500
  bauxite: "#d97706", // Amber 600
  caterium_ore: "#fbbf24", // Amber 400
  uranium: "#22c55e", // Green 500
  water: "#06b6d4", // Cyan 500
  crude_oil: "#1e293b", // Slate 800
  sulfur: "#fde047", // Yellow 300
  nitrogen_gas: "#38bdf8", // Sky 400
  sam: "#c084fc", // Purple 400

  // Iron Tier
  iron_ingot: "#0ea5e9", // Vivid Sky Blue (refined metal)
  iron_plate: "#2563eb", // Royal Cobalt Blue (structural plate)
  iron_rod: "#06b6d4", // Cyan 500 (slender rod)
  screw: "#d946ef", // Fuchsia/Magenta (high contrast against blue/slate)
  reinforced_iron_plate: "#ec4899", // Pink 500 (composite)
  modular_frame: "#10b981", // Emerald 500 (heavy structural)
  heavy_modular_frame: "#059669", // Emerald 600

  // Copper Tier
  copper_ingot: "#ea580c", // Orange 600
  wire: "#facc15", // Yellow 400 (electrical wire)
  cable: "#b45309", // Amber 700 (sheathed cable)
  copper_sheet: "#c2410c", // Orange 700

  // Steel Tier
  steel_ingot: "#14b8a6", // Teal 500
  steel_beam: "#7c3aed", // Deep Violet (completely distinct from blue plate and sky ingot)
  steel_pipe: "#6366f1", // Indigo 500
  encased_industrial_beam: "#64748b", // Slate 500
  rotor: "#8b5cf6", // Violet 500
  stator: "#9333ea", // Purple 600
  motor: "#a855f7", // Purple 500

  // Minerals & Advanced
  concrete: "#ca8a04", // Dark amber/tan
  quartz_crystal: "#fb7185", // Rose 400
  silica: "#e2e8f0", // Slate 200
  circuit_board: "#16a34a", // Green 600
  computer: "#047857", // Emerald 700
};

export const FALLBACK_COLOR = "#38bdf8";

export function getItemColor(itemId: string): string {
  if (!itemId) return FALLBACK_COLOR;
  const key = itemId.toLowerCase().trim();
  if (ITEM_COLORS[key]) return ITEM_COLORS[key];

  // Pattern matching fallbacks
  if (key.includes("screw")) return ITEM_COLORS.screw;
  if (key.includes("plate") && key.includes("reinforced")) return ITEM_COLORS.reinforced_iron_plate;
  if (key.includes("plate")) return ITEM_COLORS.iron_plate;
  if (key.includes("rod")) return ITEM_COLORS.iron_rod;
  if (key.includes("frame")) return ITEM_COLORS.modular_frame;
  if (key.includes("wire")) return ITEM_COLORS.wire;
  if (key.includes("cable")) return ITEM_COLORS.cable;
  if (key.includes("beam")) return ITEM_COLORS.steel_beam;
  if (key.includes("pipe")) return ITEM_COLORS.steel_pipe;
  if (key.includes("steel")) return ITEM_COLORS.steel_ingot;
  if (key.includes("copper")) return ITEM_COLORS.copper_ingot;
  if (key.includes("iron")) return ITEM_COLORS.iron_ingot;
  if (key.includes("coal")) return ITEM_COLORS.coal;

  return FALLBACK_COLOR;
}

export function formatItemName(itemId: string): string {
  if (!itemId) return "";
  return itemId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Raw resource value weight multiplier.
 * Common ores (Iron, Copper, Limestone) = 1.0 point
 * Intermediate energy/chemical (Coal, Sulfur) = 1.5 - 2.0 points
 * Rare / Precious (Caterium, Quartz, Oil) = 2.5 points
 * High-tech / Nuclear / SAM = 3.5 - 5.0 points
 */
export const RESOURCE_VALUE_WEIGHTS: Record<string, number> = {
  iron_ore: 1.0,
  copper_ore: 1.0,
  limestone: 1.0,
  water: 0.5,

  coal: 1.5,
  sulfur: 2.0,

  raw_quartz: 2.5,
  caterium_ore: 2.5,
  crude_oil: 2.5,
  nitrogen_gas: 2.0,

  bauxite: 3.5,
  uranium: 4.5,
  sam: 5.0,
};

/**
 * Calculates a weighted resource score for a variant.
 * Lower score = more resource efficient taking item rarity into account.
 */
export function calculateResourceScore(
  resourceUsage: Record<string, number>
): number {
  if (!resourceUsage) return 0;
  return Object.entries(resourceUsage).reduce((total, [item, rate]) => {
    const key = item.toLowerCase();
    const weight = RESOURCE_VALUE_WEIGHTS[key] ?? 1.0;
    return total + rate * weight;
  }, 0);
}
