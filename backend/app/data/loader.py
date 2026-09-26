"""
Data loader for Satisfactory Factory Blueprint Builder.

Reads the comprehensive game data from JSON and parses it into GameData.
"""

import json
from pathlib import Path
from typing import Optional

from app.data.models import (
    Item, ItemForm, Recipe, RecipeIO, Building, GameData
)

_cached_game_data: Optional[GameData] = None

def get_game_data() -> GameData:
    """Load and return the GameData singleton."""
    global _cached_game_data
    if _cached_game_data is not None:
        return _cached_game_data

    data_dir = Path(__file__).parent / "game_data"
    data_file = data_dir / "data.json"

    if not data_file.exists():
        raise FileNotFoundError(f"Could not find game data file at {data_file}")

    with open(data_file, "r", encoding="utf-8") as f:
        try:
            raw_data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse game data JSON: {e}")

    items = {}
    for item_id, item_data in raw_data.get("items", {}).items():
        items[item_id] = Item(
            id=item_id,
            display_name=item_data["display_name"],
            form=ItemForm(item_data.get("form", "solid")),
            is_resource=item_data.get("is_resource", False),
            sink_points=item_data.get("sink_points", 0),
            icon_color=item_data.get("icon_color", "#CCCCCC")
        )

    buildings = {}
    for build_id, build_data in raw_data.get("buildings", {}).items():
        buildings[build_id] = Building(
            id=build_id,
            display_name=build_data["display_name"],
            power_consumption=build_data["power_consumption"],
            power_exponent=build_data.get("power_exponent", 1.321929),
            width=build_data.get("width", 8.0),
            length=build_data.get("length", 10.0),
            height=build_data.get("height", 8.0),
            solid_inputs=build_data.get("solid_inputs", 1),
            solid_outputs=build_data.get("solid_outputs", 1),
            fluid_inputs=build_data.get("fluid_inputs", 0),
            fluid_outputs=build_data.get("fluid_outputs", 0)
        )

    recipes = {}
    for recipe_id, recipe_data in raw_data.get("recipes", {}).items():
        ingredients = [
            RecipeIO(item_id=ing["item_id"], amount=ing["amount"])
            for ing in recipe_data.get("ingredients", [])
        ]
        products = [
            RecipeIO(item_id=prod["item_id"], amount=prod["amount"])
            for prod in recipe_data.get("products", [])
        ]

        recipes[recipe_id] = Recipe(
            id=recipe_id,
            display_name=recipe_data["display_name"],
            machine_id=recipe_data["machine_id"],
            duration=recipe_data["duration"],
            ingredients=ingredients,
            products=products,
            is_alternate=recipe_data.get("is_alternate", False)
        )

    belt_speeds = raw_data.get("belt_speeds", [60, 120, 270, 480, 780, 1200])

    _cached_game_data = GameData(
        items=items,
        recipes=recipes,
        buildings=buildings,
        belt_speeds=belt_speeds
    )

    return _cached_game_data


# Alias for backward compatibility
load_game_data = get_game_data
