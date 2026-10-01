/**
 * TypeScript interfaces matching the backend API schemas.
 */

export interface SolveRequest {
  mode: "resource_constrained" | "target_driven";
  resources?: Record<string, number>;
  targets?: Record<string, number>;
  target_items?: string[];
  unlocked_alts?: string[];
  optimization?: string;
  max_belt_tier?: number;
}

export interface ProductionStep {
  step_id: string;
  recipe_id: string;
  recipe_name: string;
  machine: string;
  machine_count: number;
  clock_speed: number;
  input_rates: Record<string, number>;
  output_rates: Record<string, number>;
  power_mw: number;
  normal_machine_count: number;
  underclocked_machine_count: number;
  underclock_clock_speed: number;
}

export interface BeltConnection {
  from_step: string;
  to_step: string;
  item: string;
  rate: number;
  belt_tier: number;
  belt_count: number;
  rate_per_belt: number;
  feeds_normal_machines: number;
  feeds_underclocked_machines: number;
  feeds_underclock_clock: number;
  feed_description: string;
}

export interface SolveResponse {
  steps: ProductionStep[];
  connections: BeltConnection[];
  blueprint_svg: string;
  total_power_mw: number;
  total_machines: number;
  target_outputs: Record<string, number>;
  resource_usage: Record<string, number>;
  shopping_list: Record<string, number>;
}

export interface CompareVariant {
  label: string;
  recipe_set: string[];
  total_machines: number;
  total_power_mw: number;
  target_outputs: Record<string, number>;
  resource_usage: Record<string, number>;
  shopping_list: Record<string, number>;
  blueprint_svg: string;
  steps: ProductionStep[];
  connections: BeltConnection[];
}

export interface CompareResponse {
  variants: CompareVariant[];
  best_machines: string;
  best_power: string;
}

export interface GameItem {
  id: string;
  display_name: string;
  form: string;
  is_resource: boolean;
}

export interface GameRecipe {
  id: string;
  display_name: string;
  machine: string;
  duration: number;
  ingredients: { item_id: string; amount: number }[];
  products: { item_id: string; amount: number }[];
  is_alternate: boolean;
}

export interface GameBuilding {
  id: string;
  display_name: string;
  power_mw: number;
}

// UI state types
export interface ResourceInput {
  item_id: string;
  display_name: string;
  rate: number;
}

export type SolveMode = "resource_constrained" | "target_driven";
