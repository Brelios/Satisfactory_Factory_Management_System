"""
Utility functions for rate calculations.
"""

import math
from app.data.models import Recipe, Building, ProductionStep, BeltConnection


def calculate_machine_count(recipe: Recipe, item_id: str, desired_rate: float) -> float:
    """How many machines needed to produce desired_rate of item_id using recipe."""
    output_rate = recipe.output_rate(item_id)
    if output_rate <= 0:
        return 0.0
    return desired_rate / output_rate


def calculate_clock_speed(machine_count_fractional: float, machine_count_actual: int) -> float:
    """Calculate the clock speed for the last machine to achieve fractional count.

    If fractional=2.7 and actual=3, last machine runs at 70%.
    If fractional=3.0 and actual=3, all machines run at 100%.
    Returns clock speed percentage for the last machine.
    """
    if machine_count_actual == 0:
        return 0.0
    if machine_count_actual == 1:
        return min(machine_count_fractional * 100.0, 100.0)

    # If fractional is very close to actual (all machines at 100%)
    if abs(machine_count_fractional - machine_count_actual) < 0.001:
        return 100.0

    remainder = machine_count_fractional - (machine_count_actual - 1)
    clock = max(remainder * 100.0, 1.0)  # Minimum 1% to avoid zero
    return min(clock, 100.0)


def calculate_power(building: Building, machine_count: int, last_machine_clock: float) -> float:
    """Power for (machine_count-1) machines at 100% + 1 machine at last_machine_clock."""
    if machine_count <= 0:
        return 0.0
    if machine_count == 1:
        return building.power_at_clock(last_machine_clock)

    full_machines = machine_count - 1
    return full_machines * building.power_at_clock(100.0) + building.power_at_clock(last_machine_clock)


def select_belt_tier(
    rate: float,
    belt_speeds: list[int],
    max_tier: int | None = None
) -> tuple[int, int, float]:
    """Returns (belt_tier, belt_count, rate_per_belt).

    If max_tier is given, limits single belt throughput to belt_speeds[max_tier - 1],
    and splits excess rate across parallel belts.
    """
    if not belt_speeds or rate <= 0:
        return 1, 1, rate

    effective_max_tier = min(max_tier, len(belt_speeds)) if max_tier else len(belt_speeds)
    effective_max_tier = max(1, effective_max_tier)
    max_speed_per_belt = belt_speeds[effective_max_tier - 1]

    if rate <= max_speed_per_belt:
        for i in range(effective_max_tier):
            if rate <= belt_speeds[i]:
                return i + 1, 1, rate
        return effective_max_tier, 1, rate
    else:
        # Flow exceeds max belt capacity -> split across parallel lines
        belt_count = math.ceil(rate / max_speed_per_belt)
        rate_per_belt = rate / belt_count
        tier = effective_max_tier
        for i in range(effective_max_tier):
            if rate_per_belt <= belt_speeds[i]:
                tier = i + 1
                break
        return tier, belt_count, rate_per_belt


def calculate_total_shopping_list(steps: list[ProductionStep], connections: list[BeltConnection]) -> dict[str, int]:
    """Count machines by type, add splitters/mergers estimate."""
    shopping_list = {}

    for step in steps:
        machine_id = step.machine_id
        shopping_list[machine_id] = shopping_list.get(machine_id, 0) + step.machine_count

    if connections:
        total_splitters_mergers = 0
        for c in connections:
            total_splitters_mergers += 1
            if c.belt_count > 1:
                # Additional splitters/mergers for parallel line distribution
                total_splitters_mergers += (c.belt_count - 1) * 2
        shopping_list["Conveyor Splitter / Merger (est.)"] = total_splitters_mergers

    return shopping_list
