"""
Directed acyclic graph (DAG) of recipes needed to produce target items.
"""

import networkx as nx
from app.data.models import GameData, Recipe


class RecipeGraphBuilder:
    """Builds a DAG of recipes for target items."""

    def __init__(self, game_data: GameData, unlocked_alts: set[str] | None = None):
        self.game_data = game_data
        self.unlocked_alts = unlocked_alts or set()

    def select_recipe(self, item_id: str) -> Recipe | None:
        """Select the best recipe for an item.
        
        Priority:
        1. If user has unlocked a specific alt recipe for this item, use it
           — but ONLY if the recipe ID is in unlocked_alts (explicit selection).
        2. Otherwise, use the default (non-alternate) recipe.
        3. Returns None for raw resources.
        """
        item = self.game_data.items.get(item_id)
        if not item or item.is_resource:
            return None

        # Get all recipes that produce this item
        all_recipes = self.game_data.get_recipes_for_item(
            item_id,
            include_alts=True,
            unlocked_alts=self.unlocked_alts
        )

        if not all_recipes:
            return None

        # Check if user explicitly selected an alt recipe by ID
        for r in all_recipes:
            if r.is_alternate and r.id in self.unlocked_alts:
                return r

        # Fall back to default recipe
        default = self.game_data.get_default_recipe_for_item(item_id)
        return default or all_recipes[0]

    def get_all_recipe_options(self, item_id: str) -> list[Recipe]:
        """Get all possible recipes (default + alts) for an item."""
        item = self.game_data.items.get(item_id)
        if not item or item.is_resource:
            return []
        return self.game_data.get_recipes_for_item(
            item_id, include_alts=True, unlocked_alts=self.unlocked_alts
        )

    def build_graph(self, target_items: list[str]) -> nx.DiGraph:
        """
        Build recipe graph from target items recursively down to raw resources.
        Edges represent item flow: A -> B means A produces an item that B consumes.
        """
        graph = nx.DiGraph()
        visited_items = set()
        queue = list(target_items)

        while queue:
            item_id = queue.pop(0)
            if item_id in visited_items:
                continue
            visited_items.add(item_id)

            recipe = self.select_recipe(item_id)
            if not recipe:
                continue

            recipe_id = recipe.id
            if recipe_id not in graph.nodes:
                graph.add_node(recipe_id, recipe=recipe, machine_id=recipe.machine_id)
                for ing in recipe.ingredients:
                    queue.append(ing.item_id)

        # Build edges based on item flow between recipes
        nodes_list = list(graph.nodes)
        for consumer_node in nodes_list:
            consumer_recipe = graph.nodes[consumer_node]['recipe']
            for ing in consumer_recipe.ingredients:
                ing_id = ing.item_id
                for supplier_node in nodes_list:
                    if supplier_node == consumer_node:
                        continue
                    supplier_recipe = graph.nodes[supplier_node]['recipe']
                    if any(p.item_id == ing_id for p in supplier_recipe.products):
                        graph.add_edge(supplier_node, consumer_node, item_id=ing_id)

        return graph

    def get_production_order(self, graph: nx.DiGraph) -> list[str]:
        """Topological sort (raw resources first, final products last)."""
        try:
            return list(nx.topological_sort(graph))
        except nx.NetworkXUnfeasible:
            return list(graph.nodes)
