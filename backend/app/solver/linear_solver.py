"""
Linear programming solver for optimal production.
"""

import math
import networkx as nx
from scipy.optimize import linprog

from app.data.models import (
    GameData, OptimizationGoal, SolveMode,
    SolverResult, ProductionStep, BeltConnection
)
from app.solver.recipe_graph import RecipeGraphBuilder
from app.solver.rate_calculator import (
    calculate_clock_speed, calculate_power,
    select_belt_tier, calculate_total_shopping_list
)


class ProductionSolver:
    """Linear programming solver for Satisfactory production."""

    def __init__(self, game_data: GameData):
        self.game_data = game_data

    def solve_resource_constrained(
        self,
        available_resources: dict[str, float],
        target_items: list[str],
        unlocked_alts: set[str] | None = None,
        optimization: OptimizationGoal = OptimizationGoal.MAXIMIZE_OUTPUT,
        max_belt_tier: int | None = None,
    ) -> SolverResult:
        """Maximize production of target items given resource limits."""
        graph_builder = RecipeGraphBuilder(self.game_data, unlocked_alts)
        graph = graph_builder.build_graph(target_items)
        recipes_order = graph_builder.get_production_order(graph)

        if not recipes_order:
            return self._empty_result(SolveMode.RESOURCE_CONSTRAINED, optimization)

        n_vars = len(recipes_order)
        recipe_to_idx = {r_id: i for i, r_id in enumerate(recipes_order)}

        # Collect all items involved
        all_items = set()
        for r_id in recipes_order:
            recipe = graph.nodes[r_id]['recipe']
            for ing in recipe.ingredients:
                all_items.add(ing.item_id)
            for prod in recipe.products:
                all_items.add(prod.item_id)

        A_ub = []
        b_ub = []

        for item_id in all_items:
            item = self.game_data.items.get(item_id)
            is_resource = item.is_resource if item else False

            # Row: consumption - production for each recipe
            row = [0.0] * n_vars
            for r_id in recipes_order:
                recipe = graph.nodes[r_id]['recipe']
                idx = recipe_to_idx[r_id]
                cons = recipe.input_rate(item_id)
                prod = recipe.output_rate(item_id)
                row[idx] = cons - prod

            if is_resource:
                # Resource constraint: total consumption <= available
                avail = available_resources.get(item_id, 0.0)
                A_ub.append(row)
                b_ub.append(avail)
            else:
                # Flow conservation: consumption - production <= 0
                # (production must meet or exceed consumption)
                A_ub.append(row)
                b_ub.append(0.0)

        # Objective function
        c = [0.0] * n_vars
        if optimization == OptimizationGoal.MAXIMIZE_OUTPUT:
            # Weight each target proportionally by its recipe complexity
            # to prevent starvation of high-tier products
            for r_id in recipes_order:
                recipe = graph.nodes[r_id]['recipe']
                idx = recipe_to_idx[r_id]
                for t in target_items:
                    net = recipe.output_rate(t) - recipe.input_rate(t)
                    if net > 0:
                        # Weight by output rate so complex products get fair share
                        c[idx] = -net
        elif optimization == OptimizationGoal.MINIMIZE_POWER:
            # Minimize total power consumption
            for r_id in recipes_order:
                recipe = graph.nodes[r_id]['recipe']
                idx = recipe_to_idx[r_id]
                building = self.game_data.buildings.get(recipe.machine_id)
                if building:
                    c[idx] = building.power_consumption
        elif optimization == OptimizationGoal.MINIMIZE_MACHINES:
            # Minimize total machine count
            for r_id in recipes_order:
                idx = recipe_to_idx[r_id]
                c[idx] = 1.0

        bounds = [(0, None) for _ in range(n_vars)]

        if not A_ub:
            A_ub = [[0] * n_vars]
            b_ub = [0]

        res = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method='highs')

        if not res.success:
            return self._empty_result(SolveMode.RESOURCE_CONSTRAINED, optimization)

        machine_counts = {r_id: float(res.x[i]) for r_id, i in recipe_to_idx.items()}
        return self._build_solver_result(
            machine_counts, graph, SolveMode.RESOURCE_CONSTRAINED, optimization, max_belt_tier
        )

    def solve_target_driven(
        self,
        targets: dict[str, float],
        unlocked_alts: set[str] | None = None,
        optimization: OptimizationGoal = OptimizationGoal.MAXIMIZE_OUTPUT,
        max_belt_tier: int | None = None,
    ) -> SolverResult:
        """Calculate exact resources needed for target output rates.
        
        Uses LP to find the minimum-resource solution that produces
        at least the requested rates of each target item.
        """
        target_items = list(targets.keys())
        graph_builder = RecipeGraphBuilder(self.game_data, unlocked_alts)
        graph = graph_builder.build_graph(target_items)
        recipes_order = graph_builder.get_production_order(graph)

        if not recipes_order:
            return self._empty_result(SolveMode.TARGET_DRIVEN, optimization)

        n_vars = len(recipes_order)
        recipe_to_idx = {r_id: i for i, r_id in enumerate(recipes_order)}

        # Collect all items
        all_items = set()
        for r_id in recipes_order:
            recipe = graph.nodes[r_id]['recipe']
            for ing in recipe.ingredients:
                all_items.add(ing.item_id)
            for prod in recipe.products:
                all_items.add(prod.item_id)

        A_ub = []
        b_ub = []

        for item_id in all_items:
            item = self.game_data.items.get(item_id)
            is_resource = item.is_resource if item else False

            row = [0.0] * n_vars
            for r_id in recipes_order:
                recipe = graph.nodes[r_id]['recipe']
                idx = recipe_to_idx[r_id]
                cons = recipe.input_rate(item_id)
                prod = recipe.output_rate(item_id)
                row[idx] = cons - prod

            if is_resource:
                # No resource limit in target-driven mode — skip
                continue
            elif item_id in targets:
                # Target items: production - consumption >= target_rate
                # i.e., consumption - production <= -target_rate
                A_ub.append(row)
                b_ub.append(-targets[item_id])
            else:
                # Intermediate items: production >= consumption
                A_ub.append(row)
                b_ub.append(0.0)

        # Objective: minimize total resource consumption (or power/machines)
        c = [0.0] * n_vars
        if optimization == OptimizationGoal.MINIMIZE_POWER:
            for r_id in recipes_order:
                recipe = graph.nodes[r_id]['recipe']
                idx = recipe_to_idx[r_id]
                building = self.game_data.buildings.get(recipe.machine_id)
                if building:
                    c[idx] = building.power_consumption
        elif optimization == OptimizationGoal.MINIMIZE_MACHINES:
            for r_id in recipes_order:
                idx = recipe_to_idx[r_id]
                c[idx] = 1.0
        else:
            # Default: minimize total raw resource consumption
            for r_id in recipes_order:
                recipe = graph.nodes[r_id]['recipe']
                idx = recipe_to_idx[r_id]
                for ing in recipe.ingredients:
                    item = self.game_data.items.get(ing.item_id)
                    if item and item.is_resource:
                        c[idx] = recipe.input_rate(ing.item_id)

        bounds = [(0, None) for _ in range(n_vars)]

        if not A_ub:
            A_ub = [[0] * n_vars]
            b_ub = [0]

        res = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method='highs')

        if not res.success:
            return self._empty_result(SolveMode.TARGET_DRIVEN, optimization)

        machine_counts = {r_id: float(res.x[i]) for r_id, i in recipe_to_idx.items()}
        return self._build_solver_result(
            machine_counts, graph, SolveMode.TARGET_DRIVEN, optimization, max_belt_tier
        )

    def solve_compare(
        self,
        available_resources: dict[str, float] | None = None,
        targets: dict[str, float] | None = None,
        target_items: list[str] | None = None,
        unlocked_alts: set[str] | None = None,
        optimization: OptimizationGoal = OptimizationGoal.MAXIMIZE_OUTPUT,
        max_belt_tier: int | None = None,
    ) -> list[dict]:
        """Generate multiple blueprint variants using different recipe combos.
        
        Returns a list of dicts, each containing:
        - result: SolverResult
        - recipe_set: list of recipe IDs used
        - label: human-readable name for this variant
        """
        from itertools import product as iterproduct

        mode = "resource_constrained" if available_resources else "target_driven"
        final_targets = target_items or (list(targets.keys()) if targets else [])

        # Find all items that have alternate recipes
        graph_builder = RecipeGraphBuilder(self.game_data, unlocked_alts)
        base_graph = graph_builder.build_graph(final_targets)

        # Identify items with multiple recipe options
        items_with_choices: dict[str, list[str]] = {}
        visited = set()
        queue = list(final_targets)
        while queue:
            item_id = queue.pop(0)
            if item_id in visited:
                continue
            visited.add(item_id)
            options = graph_builder.get_all_recipe_options(item_id)
            if len(options) > 1:
                items_with_choices[item_id] = [r.id for r in options]
            if options:
                for ing in options[0].ingredients:
                    queue.append(ing.item_id)

        # Generate recipe combos (cap at 32 to avoid explosion)
        if not items_with_choices:
            # No choices — just return single result
            if mode == "resource_constrained":
                result = self.solve_resource_constrained(
                    available_resources, final_targets, unlocked_alts, optimization, max_belt_tier
                )
            else:
                result = self.solve_target_driven(targets, unlocked_alts, optimization, max_belt_tier)
            return [{"result": result, "recipe_set": [], "label": "Default Recipes"}]

        choice_keys = list(items_with_choices.keys())
        choice_values = [items_with_choices[k] for k in choice_keys]

        variants = []
        combo_count = 0
        for combo in iterproduct(*choice_values):
            if combo_count >= 32:
                break
            combo_count += 1

            # Build alt set from this combination
            alt_set = set(combo)

            try:
                if mode == "resource_constrained":
                    result = self.solve_resource_constrained(
                        available_resources, final_targets, alt_set, optimization, max_belt_tier
                    )
                else:
                    result = self.solve_target_driven(targets, alt_set, optimization, max_belt_tier)

                if result.steps:  # Only include successful solves
                    # Build a human-readable label
                    label_parts = []
                    for item_id, recipe_id in zip(choice_keys, combo):
                        recipe = self.game_data.recipes.get(recipe_id)
                        if recipe and recipe.is_alternate:
                            label_parts.append(recipe.display_name)
                    label = " + ".join(label_parts) if label_parts else "Default Recipes"

                    variants.append({
                        "result": result,
                        "recipe_set": list(combo),
                        "label": label,
                        "total_machines": result.total_machines,
                        "total_power": result.total_power,
                        "target_outputs": result.target_outputs,
                    })
            except Exception:
                continue

        # Sort by efficiency: fewer machines first
        variants.sort(key=lambda v: v["total_machines"])

        return variants

    def _empty_result(self, mode: SolveMode, opt: OptimizationGoal) -> SolverResult:
        return SolverResult([], [], 0.0, {}, {}, {}, mode, opt)

    def _build_solver_result(
        self,
        recipe_machines: dict[str, float],
        graph,
        mode: SolveMode,
        optimization: OptimizationGoal,
        max_belt_tier: int | None = None,
    ) -> SolverResult:

        steps = []
        connections = []
        target_outputs = {}
        resource_usage = {}
        total_power = 0.0

        try:
            recipes_order = list(nx.topological_sort(graph))
        except nx.NetworkXUnfeasible:
            recipes_order = list(graph.nodes)

        item_production = {}
        item_consumption = {}

        for r_id in recipes_order:
            frac = recipe_machines.get(r_id, 0.0)
            if frac <= 1e-6:
                continue

            recipe = graph.nodes[r_id]['recipe']
            building = self.game_data.buildings.get(recipe.machine_id)
            if not building:
                continue

            # Smart rounding: snap near-integer values, otherwise ceil
            rounded = round(frac)
            actual_count = rounded if abs(frac - rounded) < 0.01 else math.ceil(frac)
            actual_count = max(actual_count, 1)
            clock = calculate_clock_speed(frac, actual_count)
            power = calculate_power(building, actual_count, clock)
            total_power += power

            in_rates = {k: v * frac for k, v in recipe.all_input_rates().items()}
            out_rates = {k: v * frac for k, v in recipe.all_output_rates().items()}

            for k, v in in_rates.items():
                item_consumption[k] = item_consumption.get(k, 0.0) + v
            for k, v in out_rates.items():
                item_production[k] = item_production.get(k, 0.0) + v

            steps.append(ProductionStep(
                step_id=r_id,
                recipe_id=r_id,
                recipe=recipe,
                machine_id=recipe.machine_id,
                building=building,
                machine_count=actual_count,
                fractional_machines=frac,
                clock_speed=clock,
                input_rates=in_rates,
                output_rates=out_rates,
                power_draw=power
            ))

        for u, v, data in graph.edges(data=True):
            if recipe_machines.get(u, 0) > 1e-6 and recipe_machines.get(v, 0) > 1e-6:
                item_id = data['item_id']
                u_out = graph.nodes[u]['recipe'].output_rate(item_id) * recipe_machines[u]
                v_in = graph.nodes[v]['recipe'].input_rate(item_id) * recipe_machines[v]
                rate = min(u_out, v_in)
                if rate > 1e-6:
                    tier, belt_count, rate_per_belt = select_belt_tier(
                        rate, self.game_data.belt_speeds, max_belt_tier
                    )
                    connections.append(BeltConnection(
                        from_step_id=u,
                        to_step_id=v,
                        item_id=item_id,
                        rate=rate,
                        belt_tier=tier,
                        belt_count=belt_count,
                        rate_per_belt=rate_per_belt
                    ))

        for item_id in set(list(item_production.keys()) + list(item_consumption.keys())):
            item = self.game_data.items.get(item_id)
            if not item:
                continue
            net = item_production.get(item_id, 0.0) - item_consumption.get(item_id, 0.0)
            if item.is_resource:
                resource_usage[item_id] = -net if net < 0 else 0.0
            elif net > 1e-6:
                target_outputs[item_id] = net

        shopping_list = calculate_total_shopping_list(steps, connections)

        return SolverResult(
            steps=steps,
            connections=connections,
            total_power=total_power,
            target_outputs=target_outputs,
            resource_usage=resource_usage,
            shopping_list=shopping_list,
            mode=mode,
            optimization=optimization
        )
