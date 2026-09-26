"""
Integration test: 720 iron ore/min → modular frames
This is the user's exact scenario.
"""
import sys
import json

# Add the backend to path
sys.path.insert(0, ".")

from app.data.loader import load_game_data
from app.solver.linear_solver import ProductionSolver
from app.layout.svg_generator import BlueprintGenerator
from app.data.models import OptimizationGoal

def main():
    print("=" * 70)
    print("SATISFACTORY FACTORY BLUEPRINT BUILDER - Integration Test")
    print("=" * 70)
    
    # 1. Load game data
    print("\n[1] Loading game data...")
    game_data = load_game_data()
    print(f"    Loaded {len(game_data.items)} items, {len(game_data.recipes)} recipes, {len(game_data.buildings)} buildings")
    
    # 2. Test target-driven mode: "I want 10 modular frames/min"
    print("\n[2] Target-driven solve: 10 Modular Frames/min")
    print("-" * 50)
    solver = ProductionSolver(game_data)
    result = solver.solve_target_driven(
        targets={"modular_frame": 10},
        optimization=OptimizationGoal.MAXIMIZE_OUTPUT
    )
    
    print(f"    Total machines: {result.total_machines}")
    print(f"    Total power: {result.total_power:.1f} MW")
    print(f"    Target outputs: {result.target_outputs}")
    print(f"    Resources needed: {result.resource_usage}")
    print(f"\n    Production Steps:")
    for step in result.steps:
        print(f"      {step.machine_count}× {step.building.display_name} ({step.recipe.display_name})")
        print(f"        In:  {step.input_rates}")
        print(f"        Out: {step.output_rates}")
        print(f"        Clock: {step.clock_speed:.1f}%, Power: {step.power_draw:.1f} MW")
    
    print(f"\n    Belt Connections:")
    for conn in result.connections:
        print(f"      {conn.from_step_id} → {conn.to_step_id}: {conn.item_id} @ {conn.rate:.1f}/min (Mk.{conn.belt_tier})")
    
    print(f"\n    Shopping List: {result.shopping_list}")
    
    # 3. Test resource-constrained mode: "I have 720 iron ore, make modular frames"
    print("\n\n[3] Resource-constrained solve: 720 iron ore/min → Modular Frames")
    print("-" * 50)
    result2 = solver.solve_resource_constrained(
        available_resources={"iron_ore": 720},
        target_items=["modular_frame"],
        optimization=OptimizationGoal.MAXIMIZE_OUTPUT
    )
    
    print(f"    Total machines: {result2.total_machines}")
    print(f"    Total power: {result2.total_power:.1f} MW")
    print(f"    Target outputs: {result2.target_outputs}")
    print(f"    Resources used: {result2.resource_usage}")
    print(f"\n    Production Steps:")
    for step in result2.steps:
        print(f"      {step.machine_count}× {step.building.display_name} ({step.recipe.display_name})")
        print(f"        In:  { {k: round(v,1) for k,v in step.input_rates.items()} }")
        print(f"        Out: { {k: round(v,1) for k,v in step.output_rates.items()} }")
        print(f"        Clock: {step.clock_speed:.1f}%, Power: {step.power_draw:.1f} MW")
    
    print(f"\n    Shopping List: {result2.shopping_list}")
    
    # 4. Generate SVG blueprint
    print("\n\n[4] Generating SVG blueprint...")
    svg_gen = BlueprintGenerator(game_data)
    svg = svg_gen.generate(result2)
    
    svg_path = "test_blueprint.svg"
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"    Blueprint saved to: {svg_path}")
    print(f"    SVG size: {len(svg)} bytes")
    
    # 5. Also test with copper scenario from user
    print("\n\n[5] Resource-constrained: 720 iron + 240 copper → Modular Frames")
    print("-" * 50)
    result3 = solver.solve_resource_constrained(
        available_resources={"iron_ore": 720, "copper_ore": 240},
        target_items=["modular_frame"],
        optimization=OptimizationGoal.MAXIMIZE_OUTPUT
    )
    
    print(f"    Total machines: {result3.total_machines}")
    print(f"    Total power: {result3.total_power:.1f} MW")
    print(f"    Target outputs: {result3.target_outputs}")
    print(f"    Resources used: {result3.resource_usage}")
    for step in result3.steps:
        print(f"      {step.machine_count}× {step.building.display_name} ({step.recipe.display_name})")
    
    svg2 = svg_gen.generate(result3)
    with open("test_blueprint_iron_copper.svg", "w", encoding="utf-8") as f:
        f.write(svg2)
    print(f"\n    Blueprint saved to: test_blueprint_iron_copper.svg")
    
    print("\n" + "=" * 70)
    print("ALL TESTS PASSED ✓")
    print("=" * 70)

if __name__ == "__main__":
    main()
