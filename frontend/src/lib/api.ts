/**
 * API client for the Satisfactory Factory Blueprint Builder backend.
 */

import type {
  SolveRequest,
  SolveResponse,
  GameItem,
  GameRecipe,
  GameBuilding,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** Solve a production problem */
export async function solveProduction(req: SolveRequest): Promise<SolveResponse> {
  return apiFetch<SolveResponse>("/api/solve", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/** List all game items */
export async function getItems(): Promise<GameItem[]> {
  return apiFetch<GameItem[]>("/api/items");
}

/** List all raw resources */
export async function getResources(): Promise<GameItem[]> {
  return apiFetch<GameItem[]>("/api/resources");
}

/** List all recipes, optionally filtered */
export async function getRecipes(itemId?: string, altsOnly?: boolean): Promise<GameRecipe[]> {
  const params = new URLSearchParams();
  if (itemId) params.set("item", itemId);
  if (altsOnly !== undefined) params.set("alts", String(altsOnly));
  const query = params.toString();
  return apiFetch<GameRecipe[]>(`/api/recipes${query ? `?${query}` : ""}`);
}

/** List all buildings */
export async function getBuildings(): Promise<GameBuilding[]> {
  return apiFetch<GameBuilding[]>("/api/buildings");
}
