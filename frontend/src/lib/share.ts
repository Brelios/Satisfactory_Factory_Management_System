/**
 * State serialization and URL sharing utilities.
 */
import type { SolveMode, ResourceInput } from "./types";

export interface FactoryShareState {
  mode: SolveMode;
  resources: { item_id: string; rate: number }[];
  targetItems: string[];
  targetRates: Record<string, number>;
  unlockedAlts: string[];
  enforceBeltLimit?: boolean;
  maxBeltTier?: number;
  remainderStrategy?: "merge" | "underclock" | "dedicated";
  allowOverclock?: boolean;
  strictTier?: boolean;
}

const STORAGE_KEY = "satisfactory_factory_saved_plan";

export function serializePlan(state: FactoryShareState): string {
  try {
    const jsonStr = JSON.stringify(state);
    if (typeof window !== "undefined") {
      return btoa(encodeURIComponent(jsonStr));
    }
    return Buffer.from(encodeURIComponent(jsonStr)).toString("base64");
  } catch {
    return "";
  }
}

export function deserializePlan(encoded: string): FactoryShareState | null {
  try {
    let jsonStr: string;
    if (typeof window !== "undefined") {
      jsonStr = decodeURIComponent(atob(encoded));
    } else {
      jsonStr = decodeURIComponent(Buffer.from(encoded, "base64").toString());
    }
    return JSON.parse(jsonStr) as FactoryShareState;
  } catch {
    return null;
  }
}

export function savePlanToLocalStorage(state: FactoryShareState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to save plan to localStorage:", err);
  }
}

export function loadPlanFromLocalStorage(): FactoryShareState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FactoryShareState;
  } catch {
    return null;
  }
}

export function generateShareUrl(state: FactoryShareState): string {
  if (typeof window === "undefined") return "";
  const code = serializePlan(state);
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("plan", code);
  return url.toString();
}
