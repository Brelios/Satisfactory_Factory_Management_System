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
  enforce_belt_limit?: boolean;
  remainder_strategy?: "merge" | "underclock" | "dedicated";
  allow_overclock?: boolean;
  strict_tier?: boolean;
}

export interface MachineFeeder {
  belt_id: string;
  rate: number;
  source: string;
  item_id: string;
}

export interface MachineInput {
  item_id: string;
  demand: number;
  received: number;
  status: "satisfied" | "shortfall" | "underclocked";
  feeds: MachineFeeder[];
}

export interface PhysicalMachine {
  machine_id: string;
  step_id: string;
  recipe_name: string;
  machine_type: string;
  index_in_step: number;
  clock_speed: number;
  is_overclocked: boolean;
  power_shards: number;
  power_mw: number;
  inputs: Record<string, MachineInput>;
  outputs: Record<string, number>;
}

export interface PhysicalBelt {
  belt_id: string;
  item_id: string;
  flow: number;
  capacity: number;
  tier: number;
  utilization_pct: number;
  is_over_cap: boolean;
  from_node: string;
  from_port: string;
  to_node: string;
  to_port: string;
  description: string;
}

export interface PhysicalSplitter {
  splitter_id: string;
  item_id: string;
  tier: number;
  in_rate: number;
  out_rates: number[];
  from_belt: string;
  to_belts: string[];
}

export interface PhysicalMerger {
  merger_id: string;
  item_id: string;
  tier: number;
  in_rates: number[];
  out_rate: number;
  from_belts: string[];
  to_belt: string;
}

export interface PhysicalMiner {
  miner_id: string;
  item_id: string;
  node_purity: "impure" | "normal" | "pure";
  miner_tier: number;
  output_rate: number;
  clock_speed: number;
  belt_id: string;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  details: string;
  offending_ids: string[];
}

export interface LogisticsValidation {
  passed: boolean;
  all_belts_valid: boolean;
  all_inputs_satisfied: boolean;
  mass_balance_valid: boolean;
  splitter_ports_valid: boolean;
  checks: ValidationCheck[];
}

export interface TierComparisonRow {
  tier: number;
  name: string;
  capacity: number;
  lane_count: number;
  splitter_count: number;
  merger_count: number;
  belt_count: number;
  max_utilization_pct: number;
  needs_parallel: boolean;
}

export interface LogisticsPlan {
  selected_tier: number;
  belt_cap: number;
  enforce_belt_limit: boolean;
  remainder_strategy: "merge" | "underclock" | "dedicated";
  allow_overclock: boolean;
  machines: PhysicalMachine[];
  belts: PhysicalBelt[];
  splitters: PhysicalSplitter[];
  mergers: PhysicalMerger[];
  miners: PhysicalMiner[];
  validation: LogisticsValidation;
  tier_comparison: TierComparisonRow[];
  min_tier_to_avoid_splitting: number;
  total_lanes: number;
  total_splitters: number;
  total_mergers: number;
  power_shards_total: number;
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
  logistics?: LogisticsPlan;
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
  logistics?: LogisticsPlan;
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
