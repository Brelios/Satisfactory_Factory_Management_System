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
        optimization: OptimizationGoal = OptimizationGoal.MAXIMIZE_OUTPUT
    ) -> SolverResult:
        """Maximize production of target items given resource limits."""
        graph_builder = RecipeGraphBuilder(self.game_data, unlocked_alts)
        graph = graph_builder.build_graph(target_items)
        recipes_order = graph_builder.get_production_order(graph)
        
        if not recipes_order:
            return self._empty_result(SolveMode.RESOURCE_CONSTRAINED, optimization)

        n_vars = len(recipes_order)
        recipe_to_idx = {r_id: i for i, r_id in enumerate(recipes_order)}
        
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
                avail = available_resources.get(item_id, 0.0)
                A_ub.append(row)
                b_ub.append(avail)
            else:
                if item_id not in target_items:
                    A_ub.append(row)
                    b_ub.append(0.0)
                else:
                    A_ub.append(row)
                    b_ub.append(0.0)

        c = [0.0] * n_vars
        if optimization == OptimizationGoal.MAXIMIZE_OUTPUT:
            for r_id in recipes_order:
                recipe = graph.nodes[r_id]['recipe']
                idx = recipe_to_idx[r_id]
                net_target_prod = sum(
                    recipe.output_rate(t) - recipe.input_rate(t)
                    for t in target_items
                )
                c[idx] = -net_target_prod
                
        bounds = [(0, None) for _ in range(n_vars)]
        
        if not A_ub:
            A_ub = [[0]*n_vars]
            b_ub = [0]
            
        res = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method='highs')
        
        if not res.success:
            return self._empty_result(SolveMode.RESOURCE_CONSTRAINED, optimization)
            
        machine_counts = {r_id: float(res.x[i]) for r_id, i in recipe_to_idx.items()}
        return self._build_solver_result(
            machine_counts, graph, SolveMode.RESOURCE_CONSTRAINED, optimization
        )

    def solve_target_driven(
        self, 
        targets: dict[str, float], 
        unlocked_alts: set[str] | None = None, 
        optimization: OptimizationGoal = OptimizationGoal.MAXIMIZE_OUTPUT
    ) -> SolverResult:
        """Calculate minimum resources needed given target output rates."""
        target_items = list(targets.keys())
        graph_builder = RecipeGraphBuilder(self.game_data, unlocked_alts)
        graph = graph_builder.build_graph(target_items)
        recipes_order = graph_builder.get_production_order(graph)
        
        if not recipes_order:
            return self._empty_result(SolveMode.TARGET_DRIVEN, optimization)
            
        recipes_order_rev = list(reversed(recipes_order))
        item_requirements = dict(targets)
        machine_counts = {r_id: 0.0 for r_id in recipes_order}
        
        for r_id in recipes_order_rev:
            recipe = graph.nodes[r_id]['recipe']
            max_machines = 0.0
            for prod in recipe.products:
                req = item_requirements.get(prod.item_id, 0.0)
                if req > 0:
                    out_rate = recipe.output_rate(prod.item_id)
                    if out_rate > 0:
                        m = req / out_rate
                        if m > max_machines:
                            max_machines = m
                            
            machine_counts[r_id] = max_machines
            
            if max_machines > 0:
                for ing in recipe.ingredients:
                    in_rate = recipe.input_rate(ing.item_id)
                    item_requirements[ing.item_id] = item_requirements.get(ing.item_id, 0.0) + in_rate * max_machines
                    
                for prod in recipe.products:
                    out_rate = recipe.output_rate(prod.item_id)
                    current_req = item_requirements.get(prod.item_id, 0.0)
                    item_requirements[prod.item_id] = max(0.0, current_req - out_rate * max_machines)

        return self._build_solver_result(
            machine_counts, graph, SolveMode.TARGET_DRIVEN, optimization
        )

    def _empty_result(self, mode: SolveMode, opt: OptimizationGoal) -> SolverResult:
        return SolverResult([], [], 0.0, {}, {}, {}, mode, opt)

    def _build_solver_result(
        self, 
        recipe_machines: dict[str, float], 
        graph, 
        mode: SolveMode, 
        optimization: OptimizationGoal
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
                    tier = select_belt_tier(rate, self.game_data.belt_speeds)
                    connections.append(BeltConnection(
                        from_step_id=u,
                        to_step_id=v,
                        item_id=item_id,
                        rate=rate,
                        belt_tier=tier
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
