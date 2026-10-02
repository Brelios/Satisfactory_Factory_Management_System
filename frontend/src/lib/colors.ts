/**
 * Satisfactory Factory Management System
 * Item color mapping and formatting utilities.
 */

export const ITEM_COLORS: Record<string, string> = {
  // Ores & Raw Materials
  iron_ore: "#818cf8", // Indigo 400 - distinct from ingots/plates
  copper_ore: "#f97316", // Orange 500
  coal: "#64748b", // Slate 500
  limestone: "#eab308", // Yellow 500
  raw_quartz: "#f43f5e", // Rose 500
  bauxite: "#d97706", // Amber 600
  caterium_ore: "#fbbf24", // Amber 400
  uranium: "#22c55e", // Green 500
  water: "#06b6d4", // Cyan 500
  crude_oil: "#334155", // Slate 700

  // Iron Tier
  iron_ingot: "#38bdf8", // Sky 400 (refined molten/solid)
  iron_plate: "#2563eb", // Blue 600 (distinct dark blue plate)
  iron_rod: "#06b6d4", // Cyan 500 (slender rod)
  screw: "#a855f7", // Purple 500 (high contrast against plate/rod)
  reinforced_iron_plate: "#ec4899", // Pink 500 (composite)
  modular_frame: "#10b981", // Emerald 500 (heavy structural)
  heavy_modular_frame: "#059669", // Emerald 600

  // Copper Tier
  copper_ingot: "#ea580c", // Orange 600
  wire: "#facc15", // Yellow 400 (electrical wire)
  cable: "#d97706", // Amber 600 (sheathed cable)
  copper_sheet: "#c2410c", // Orange 700

  // Steel Tier
  steel_ingot: "#14b8a6", // Teal 500
  steel_beam: "#0284c7", // Sky 600
  steel_pipe: "#0ea5e9", // Sky 500
  encased_industrial_beam: "#475569", // Slate 600
  rotor: "#8b5cf6", // Violet 500
  stator: "#7c3aed", // Violet 600
  motor: "#6366f1", // Indigo 500

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
