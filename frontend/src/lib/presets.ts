/**
 * Pre-configured factory blueprint presets for quick onboarding.
 */
import type { SolveMode } from "./types";

export interface FactoryPreset {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  mode: SolveMode;
  resources: { item_id: string; rate: number }[];
  targetItems: string[];
  targetRates: Record<string, number>;
  unlockedAlts?: string[];
  maxBeltTier?: number;
}

export const FACTORY_PRESETS: FactoryPreset[] = [
  {
    id: "max_iron_modular_frame",
    name: "Max Output (720 Iron Ore)",
    subtitle: "Full Mk.3 belt of Iron Ore → 30 Modular Frames/min",
    icon: "🏭",
    mode: "resource_constrained",
    resources: [
      { item_id: "iron_ore", rate: 720 },
      { item_id: "copper_ore", rate: 0 },
      { item_id: "limestone", rate: 0 },
      { item_id: "coal", rate: 0 },
    ],
    targetItems: ["modular_frame"],
    targetRates: { modular_frame: 0 },
  },
  {
    id: "reinforced_iron_plate_10",
    name: "Reinforced Iron Plate (10/min)",
    subtitle: "Target-driven Assembler line from iron ore & screws",
    icon: "🔩",
    mode: "target_driven",
    resources: [
      { item_id: "iron_ore", rate: 0 },
      { item_id: "copper_ore", rate: 0 },
      { item_id: "limestone", rate: 0 },
      { item_id: "coal", rate: 0 },
    ],
    targetItems: ["reinforced_iron_plate"],
    targetRates: { reinforced_iron_plate: 10 },
  },
  {
    id: "steel_beam_pipe",
    name: "Basic Steel Line (120 Iron + 120 Coal)",
    subtitle: "Balanced Foundry setup producing Steel Beams",
    icon: "🏗️",
    mode: "resource_constrained",
    resources: [
      { item_id: "iron_ore", rate: 120 },
      { item_id: "coal", rate: 120 },
      { item_id: "copper_ore", rate: 0 },
      { item_id: "limestone", rate: 0 },
    ],
    targetItems: ["steel_beam"],
    targetRates: { steel_beam: 0 },
  },
  {
    id: "rotor_stator_duo",
    name: "Rotor & Stator (10/min each)",
    subtitle: "Essential Motor components from Iron & Copper",
    icon: "⚡",
    mode: "target_driven",
    resources: [
      { item_id: "iron_ore", rate: 0 },
      { item_id: "copper_ore", rate: 0 },
      { item_id: "coal", rate: 0 },
      { item_id: "limestone", rate: 0 },
    ],
    targetItems: ["rotor", "stator"],
    targetRates: { rotor: 10, stator: 10 },
  },
  {
    id: "copper_cable_line",
    name: "Pure Copper Cable (120 Ore)",
    subtitle: "Smelting and constructor chains for electrical cables",
    icon: "🔌",
    mode: "resource_constrained",
    resources: [
      { item_id: "copper_ore", rate: 120 },
      { item_id: "iron_ore", rate: 0 },
      { item_id: "limestone", rate: 0 },
      { item_id: "coal", rate: 0 },
    ],
    targetItems: ["cable"],
    targetRates: { cable: 0 },
  },
];
