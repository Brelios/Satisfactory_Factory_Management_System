from app.data.loader import load_game_data
from app.solver.linear_solver import ProductionSolver

gd = load_game_data()
solver = ProductionSolver(gd)

print("=== 1. UNCONSTRAINED (Max possible belt tier) ===")
res_unconstrained = solver.solve_resource_constrained(
    available_resources={"iron_ore": 720},
    target_items=["modular_frame"],
    max_belt_tier=None
)
print(f"Machines: {res_unconstrained.total_machines}, Power: {res_unconstrained.total_power} MW")
print("Connections:")
for c in res_unconstrained.connections:
    print(f"  {c.from_step_id} -> {c.to_step_id}: {c.item_id} @ {c.rate:.1f}/min => {c.belt_count}x Mk.{c.belt_tier} ({c.rate_per_belt:.1f}/min ea)")

print("\n=== 2. CONSTRAINED TO Mk.3 (270/min) ===")
res_mk3 = solver.solve_resource_constrained(
    available_resources={"iron_ore": 720},
    target_items=["modular_frame"],
    max_belt_tier=3
)
print(f"Machines: {res_mk3.total_machines}, Power: {res_mk3.total_power} MW")
print(f"Shopping List: {res_mk3.shopping_list}")
print("Connections:")
for c in res_mk3.connections:
    print(f"  {c.from_step_id} -> {c.to_step_id}: {c.item_id} @ {c.rate:.1f}/min => {c.belt_count}x Mk.{c.belt_tier} ({c.rate_per_belt:.1f}/min ea)")

print("\n=== 3. CONSTRAINED TO Mk.1 (60/min) ===")
res_mk1 = solver.solve_resource_constrained(
    available_resources={"iron_ore": 720},
    target_items=["modular_frame"],
    max_belt_tier=1
)
print(f"Shopping List: {res_mk1.shopping_list}")
print("Connections:")
for c in res_mk1.connections:
    print(f"  {c.from_step_id} -> {c.to_step_id}: {c.item_id} @ {c.rate:.1f}/min => {c.belt_count}x Mk.{c.belt_tier} ({c.rate_per_belt:.1f}/min ea)")
