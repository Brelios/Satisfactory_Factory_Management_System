"""
Core data models for the Satisfactory Factory Blueprint Builder.

This module defines all the data structures used throughout the system:
- Game data types (Item, Recipe, Building)
- Solver output types (ProductionStep, BeltConnection, SolverResult)
- Convenience container (GameData) with query methods

All rates are in items/min unless otherwise noted.
All power values are in Megawatts (MW).
All dimensions are in meters.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ──────────────────────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────────────────────

class ItemForm(str, Enum):
    SOLID = "solid"
    LIQUID = "liquid"
    GAS = "gas"


class OptimizationGoal(str, Enum):
    MAXIMIZE_OUTPUT = "maximize_output"
    MINIMIZE_MACHINES = "minimize_machines"
    MINIMIZE_POWER = "minimize_power"


class SolveMode(str, Enum):
    RESOURCE_CONSTRAINED = "resource_constrained"
    TARGET_DRIVEN = "target_driven"


# ──────────────────────────────────────────────────────────────
# Game Data Types
# ──────────────────────────────────────────────────────────────

@dataclass
class Item:
    """A game item (resource, intermediate, or product)."""
    id: str
    display_name: str
    form: ItemForm = ItemForm.SOLID
    is_resource: bool = False
    sink_points: int = 0
    icon_color: str = "#CCCCCC"  # hex color for blueprint rendering


@dataclass
class RecipeIO:
    """An input or output of a recipe (item + amount per cycle)."""
    item_id: str
    amount: float  # amount per single crafting cycle


@dataclass
class Recipe:
    """A crafting recipe that transforms inputs into outputs in a machine."""
    id: str
    display_name: str
    machine_id: str          # which building this runs in
    duration: float          # seconds per crafting cycle
    ingredients: list[RecipeIO]
    products: list[RecipeIO]
    is_alternate: bool = False

    def cycles_per_minute(self) -> float:
        """How many complete cycles this recipe does per minute."""
        return 60.0 / self.duration

    def input_rate(self, item_id: str) -> float:
        """Items consumed per minute (single machine, 100% clock)."""
        for ing in self.ingredients:
            if ing.item_id == item_id:
                return ing.amount * self.cycles_per_minute()
        return 0.0

    def output_rate(self, item_id: str) -> float:
        """Items produced per minute (single machine, 100% clock)."""
        for prod in self.products:
            if prod.item_id == item_id:
                return prod.amount * self.cycles_per_minute()
        return 0.0

    def all_input_rates(self) -> dict[str, float]:
        """All input rates as {item_id: items/min}."""
        return {ing.item_id: ing.amount * self.cycles_per_minute()
                for ing in self.ingredients}

    def all_output_rates(self) -> dict[str, float]:
        """All output rates as {item_id: items/min}."""
        return {prod.item_id: prod.amount * self.cycles_per_minute()
                for prod in self.products}


@dataclass
class Building:
    """A production building / machine."""
    id: str
    display_name: str
    power_consumption: float     # MW at 100% clock speed
    power_exponent: float = 1.321929
    width: float = 8.0           # meters
    length: float = 10.0         # meters
    height: float = 8.0          # meters
    solid_inputs: int = 1
    solid_outputs: int = 1
    fluid_inputs: int = 0
    fluid_outputs: int = 0

    def power_at_clock(self, clock_percent: float) -> float:
        """Calculate power consumption at a given clock speed percentage."""
        return self.power_consumption * (clock_percent / 100.0) ** self.power_exponent

    @property
    def foundation_footprint(self) -> tuple[int, int]:
        """Approximate footprint in 8m foundations (width x length)."""
        return (math.ceil(self.width / 8), math.ceil(self.length / 8))


# ──────────────────────────────────────────────────────────────
# Belt speeds (items/min) for Mk.1 through Mk.6
# ──────────────────────────────────────────────────────────────

BELT_SPEEDS: list[int] = [60, 120, 270, 480, 780, 1200]


# ──────────────────────────────────────────────────────────────
# Solver Output Types
# ──────────────────────────────────────────────────────────────

@dataclass
class ProductionStep:
    """A single production step in the solved factory plan.

    Represents a group of identical machines running the same recipe.
    """
    step_id: str              # unique identifier (usually recipe_id, or recipe_id_2 for duplicates)
    recipe_id: str
    recipe: Recipe
    machine_id: str
    building: Building
    machine_count: int        # whole machines needed (rounded up)
    fractional_machines: float  # exact fractional machine count from solver
    clock_speed: float        # percentage (100.0 = normal, <100 for last machine)
    input_rates: dict[str, float]   # item_id -> total items/min consumed
    output_rates: dict[str, float]  # item_id -> total items/min produced
    power_draw: float         # total MW for all machines at their clock speeds


@dataclass
class BeltConnection:
    """A conveyor belt connecting two production steps."""
    from_step_id: str         # source step (or "input" for raw resources)
    to_step_id: str           # destination step (or "output" for final products)
    item_id: str              # what item flows on this belt
    rate: float               # items/min
    belt_tier: int            # 1-6 (Mk.1 through Mk.6)


@dataclass
class SolverResult:
    """Complete solution from the production solver."""
    steps: list[ProductionStep]
    connections: list[BeltConnection]
    total_power: float                # total MW
    target_outputs: dict[str, float]  # item_id -> items/min produced
    resource_usage: dict[str, float]  # resource item_id -> items/min consumed
    shopping_list: dict[str, int]     # building_id or item -> count needed
    mode: SolveMode
    optimization: OptimizationGoal

    def get_step(self, step_id: str) -> Optional[ProductionStep]:
        """Find a production step by ID."""
        for step in self.steps:
            if step.step_id == step_id:
                return step
        return None

    @property
    def total_machines(self) -> int:
        """Total number of machines across all steps."""
        return sum(s.machine_count for s in self.steps)


# ──────────────────────────────────────────────────────────────
# Game Data Container
# ──────────────────────────────────────────────────────────────

@dataclass
class GameData:
    """Container for all loaded game data with query methods."""
    items: dict[str, Item]
    recipes: dict[str, Recipe]
    buildings: dict[str, Building]
    belt_speeds: list[int] = field(default_factory=lambda: list(BELT_SPEEDS))

    def get_recipes_for_item(
        self,
        item_id: str,
        include_alts: bool = True,
        unlocked_alts: Optional[set[str]] = None,
    ) -> list[Recipe]:
        """Get all recipes that produce a given item.

        Args:
            item_id: The item to find recipes for.
            include_alts: Whether to include alternate recipes.
            unlocked_alts: If provided, only include these specific alt recipe IDs.
        """
        results = []
        for recipe in self.recipes.values():
            produces_item = any(p.item_id == item_id for p in recipe.products)
            if not produces_item:
                continue

            if recipe.is_alternate:
                if not include_alts:
                    continue
                if unlocked_alts is not None and recipe.id not in unlocked_alts:
                    continue

            results.append(recipe)
        return results

    def get_default_recipe_for_item(self, item_id: str) -> Optional[Recipe]:
        """Get the default (non-alternate) recipe that produces an item."""
        for recipe in self.recipes.values():
            if recipe.is_alternate:
                continue
            if any(p.item_id == item_id for p in recipe.products):
                return recipe
        return None

    def get_recipes_using_machine(self, machine_id: str) -> list[Recipe]:
        """Get all recipes that use a given machine type."""
        return [r for r in self.recipes.values() if r.machine_id == machine_id]

    def get_belt_tier(self, rate: float) -> int:
        """Get minimum belt tier needed for a given rate (items/min).

        Returns tier 1-6. If rate exceeds Mk.6, returns 6 (may need multiple belts).
        """
        for tier, speed in enumerate(self.belt_speeds, 1):
            if speed >= rate:
                return tier
        return len(self.belt_speeds)

    def get_belt_speed(self, tier: int) -> int:
        """Get the speed of a belt tier (1-indexed)."""
        return self.belt_speeds[min(tier, len(self.belt_speeds)) - 1]

    def get_all_resources(self) -> list[Item]:
        """Get all raw resource items."""
        return [item for item in self.items.values() if item.is_resource]

    def get_all_products(self) -> list[Item]:
        """Get all non-resource items (things that can be crafted)."""
        return [item for item in self.items.values() if not item.is_resource]
