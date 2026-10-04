"""
Unit tests for Logistics Solver.
Verifies Worked Examples 1 and 2, port limits, remainder strategies, and validation checks.
"""

import sys
import os
import unittest

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.solver.logistics_solver import (
    solve_logistics,
    PhysicalMachine,
    PhysicalBelt,
    LogisticsPlan,
    BELT_SPEEDS,
)


class TestLogisticsSolver(unittest.TestCase):

    def test_worked_example_2_eight_foundries(self):
        """
        Worked Example 2:
        8 Foundries x 45 = 360/min on Mk.2 (120/min).
        3 lanes (120/min each).
        Each feeds 2 Foundries (90, surplus 30).
        Pooled surplus (30 + 30 + 30 = 90) feeds Foundries 7 and 8 at 45 each.
        """
        steps_data = [
            {
                "step_id": "foundry_steel",
                "recipe_id": "Recipe_SteelIngot_C",
                "recipe_name": "Steel Ingot",
                "machine": "Foundry",
                "machine_count": 8,
                "input_rates": {"iron_ore": 360.0, "coal": 360.0},
                "output_rates": {"steel_ingot": 360.0},
                "power_mw": 128.0,
                "normal_machine_count": 8,
                "underclocked_machine_count": 0,
                "underclock_clock_speed": 100.0,
            }
        ]

        connections_data = [
            {
                "item": "iron_ore",
                "rate": 360.0,
                "from_step": "miner_iron",
                "to_step": "foundry_steel",
            },
            {
                "item": "coal",
                "rate": 360.0,
                "from_step": "miner_coal",
                "to_step": "foundry_steel",
            },
        ]

        plan = solve_logistics(
            steps_data=steps_data,
            connections_data=connections_data,
            resource_usage={"iron_ore": 360.0, "coal": 360.0},
            target_outputs={"steel_ingot": 360.0},
            selected_tier=2,  # Mk.2: 120/min
            enforce_belt_limit=True,
            remainder_strategy="merge",
        )

        self.assertEqual(len(plan.machines), 8)
        for m in plan.machines:
            self.assertIn("iron_ore", m.inputs)
            self.assertIn("coal", m.inputs)
            self.assertAlmostEqual(m.inputs["iron_ore"].received, 45.0, places=2)
            self.assertAlmostEqual(m.inputs["coal"].received, 45.0, places=2)
            self.assertEqual(m.inputs["iron_ore"].status, "satisfied")
            self.assertEqual(m.inputs["coal"].status, "satisfied")
            self.assertAlmostEqual(m.clock_speed, 100.0)

        for b in plan.belts:
            self.assertLessEqual(b.flow, 120.0 + 1e-4)

        self.assertTrue(plan.validation.all_belts_valid)
        self.assertTrue(plan.validation.all_inputs_satisfied)
        print("PASS: test_worked_example_2_eight_foundries")

    def test_worked_example_1_pooled_surplus(self):
        """
        Worked Example 1:
        Mk.2 belt = 120/min, Foundry demand = 45/min each.
        Belt A feeds Foundry 1 and 2 = 90, surplus 30. Foundry 3 needs 45 and only has 30 (shortfall 15).
        Belt B (120/min) feeds machine group that consumes 105, surplus 15.
        Merge A's 30 + B's 15 = 45 into Foundry 3, which then runs at 100%.
        """
        steps_data = [
            {
                "step_id": "foundry_grp",
                "recipe_id": "Recipe_SteelIngot_C",
                "recipe_name": "Steel Ingot",
                "machine": "Foundry",
                "machine_count": 3,
                "input_rates": {"iron_ore": 135.0},
                "output_rates": {"steel_ingot": 135.0},
                "power_mw": 48.0,
                "normal_machine_count": 3,
                "underclocked_machine_count": 0,
                "underclock_clock_speed": 100.0,
            },
            {
                "step_id": "other_consumer",
                "recipe_id": "Recipe_Other",
                "recipe_name": "Other Product",
                "machine": "Constructor",
                "machine_count": 1,
                "input_rates": {"iron_ore": 105.0},
                "output_rates": {"other_product": 105.0},
                "power_mw": 4.0,
                "normal_machine_count": 1,
                "underclocked_machine_count": 0,
                "underclock_clock_speed": 100.0,
            },
        ]

        connections_data = [
            {
                "item": "iron_ore",
                "rate": 135.0,
                "from_step": "miner_iron_1",
                "to_step": "foundry_grp",
            },
            {
                "item": "iron_ore",
                "rate": 105.0,
                "from_step": "miner_iron_2",
                "to_step": "other_consumer",
            },
        ]

        plan = solve_logistics(
            steps_data=steps_data,
            connections_data=connections_data,
            resource_usage={"iron_ore": 240.0},
            target_outputs={"steel_ingot": 135.0, "other_product": 105.0},
            selected_tier=2,  # 120/min cap
            enforce_belt_limit=True,
            remainder_strategy="merge",
        )

        foundries = [m for m in plan.machines if m.step_id == "foundry_grp"]
        self.assertEqual(len(foundries), 3)
        for f in foundries:
            self.assertAlmostEqual(f.inputs["iron_ore"].received, 45.0, places=2)
            self.assertEqual(f.inputs["iron_ore"].status, "satisfied")

        f3 = foundries[2]
        self.assertGreater(len(f3.inputs["iron_ore"].feeds), 1)

        for b in plan.belts:
            self.assertLessEqual(b.flow, 120.0 + 1e-4)

        print("PASS: test_worked_example_1_pooled_surplus")

    def test_underclock_remainder_strategy(self):
        """
        Tests remainder strategy 'underclock'.
        If machine receives 30 of 45 -> clock = 66.667%.
        """
        steps_data = [
            {
                "step_id": "step_underclock",
                "recipe_id": "Recipe_SteelIngot_C",
                "recipe_name": "Steel Ingot",
                "machine": "Foundry",
                "machine_count": 3,
                "input_rates": {"iron_ore": 120.0},
                "output_rates": {"steel_ingot": 120.0},
                "power_mw": 48.0,
                "normal_machine_count": 2,
                "underclocked_machine_count": 1,
                "underclock_clock_speed": 66.667,
            }
        ]
        connections_data = [
            {
                "item": "iron_ore",
                "rate": 120.0,
                "from_step": "miner_iron",
                "to_step": "step_underclock",
            }
        ]

        plan = solve_logistics(
            steps_data=steps_data,
            connections_data=connections_data,
            resource_usage={"iron_ore": 120.0},
            target_outputs={"steel_ingot": 120.0},
            selected_tier=2,  # 120/min cap
            enforce_belt_limit=True,
            remainder_strategy="underclock",
        )

        self.assertEqual(len(plan.machines), 3)
        m3 = plan.machines[2]
        self.assertAlmostEqual(m3.clock_speed, 66.667, places=2)
        self.assertEqual(m3.inputs["iron_ore"].status, "underclocked")

        print("PASS: test_underclock_remainder_strategy")

    def test_port_limits_and_manifolds(self):
        """
        Test that no splitter has > 3 outputs and no merger has > 3 inputs.
        """
        steps_data = [
            {
                "step_id": f"step_consumer_{i}",
                "recipe_id": "Recipe_Rod",
                "recipe_name": "Iron Rod",
                "machine": "Constructor",
                "machine_count": 1,
                "input_rates": {"iron_ingot": 15.0},
                "output_rates": {"iron_rod": 15.0},
                "power_mw": 4.0,
                "normal_machine_count": 1,
                "underclocked_machine_count": 0,
                "underclock_clock_speed": 100.0,
            }
            for i in range(10)
        ]
        connections_data = [
            {
                "item": "iron_ingot",
                "rate": 15.0,
                "from_step": "smelter_source",
                "to_step": f"step_consumer_{i}",
            }
            for i in range(10)
        ]

        plan = solve_logistics(
            steps_data=steps_data,
            connections_data=connections_data,
            resource_usage={"iron_ore": 150.0},
            target_outputs={"iron_rod": 150.0},
            selected_tier=3,  # Mk.3 270/min
            enforce_belt_limit=True,
        )

        for s in plan.splitters:
            self.assertLessEqual(len(s.out_rates), 3)

        for m in plan.mergers:
            self.assertLessEqual(len(m.in_rates), 3)

        self.assertTrue(plan.validation.splitter_ports_valid)
        print("PASS: test_port_limits_and_manifolds")

    def test_overclocking_power_shards(self):
        """
        Test overclocking toggle: machines up to 250% clock speed calculate power shards.
        """
        steps_data = [
            {
                "step_id": "overclocked_step",
                "recipe_id": "Recipe_Ingot",
                "recipe_name": "Iron Ingot",
                "machine": "Smelter",
                "machine_count": 1,
                "clock_speed": 200.0,
                "input_rates": {"iron_ore": 60.0},
                "output_rates": {"iron_ingot": 60.0},
                "power_mw": 8.0,
                "normal_machine_count": 1,
                "underclocked_machine_count": 0,
                "underclock_clock_speed": 200.0,
            }
        ]
        connections_data = [
            {
                "item": "iron_ore",
                "rate": 60.0,
                "from_step": "miner_source",
                "to_step": "overclocked_step",
            }
        ]
        plan = solve_logistics(
            steps_data=steps_data,
            connections_data=connections_data,
            resource_usage={"iron_ore": 60.0},
            target_outputs={"iron_ingot": 60.0},
            selected_tier=2,
            enforce_belt_limit=True,
            allow_overclock=True,
        )
        m = plan.machines[0]
        self.assertTrue(m.is_overclocked)
        self.assertEqual(m.power_shards, 2)  # 200% clock = 2 shards
        self.assertAlmostEqual(m.clock_speed, 200.0)

        print("PASS: test_overclocking_power_shards")

    def test_pipeline_fluid_constraints(self):
        """
        Test pipeline capacity constraints and transport_type='pipe' for fluid items.
        Mk.1 pipe cap = 300 m³/min, Mk.2 pipe cap = 600 m³/min.
        """
        steps_data = [
            {
                "step_id": "refinery_step",
                "recipe_id": "Recipe_Fuel_C",
                "recipe_name": "Fuel",
                "machine": "Refinery",
                "machine_count": 6,
                "input_rates": {"crude_oil": 360.0},
                "output_rates": {"fuel": 240.0},
                "power_mw": 180.0,
                "normal_machine_count": 6,
                "underclocked_machine_count": 0,
                "underclock_clock_speed": 100.0,
            }
        ]
        connections_data = [
            {
                "item": "crude_oil",
                "rate": 360.0,
                "from_step": "extractor_oil",
                "to_step": "refinery_step",
            }
        ]
        # Mk.1 pipe: cap 300, 360 m³/min requires 2 pipe lanes
        plan_mk1 = solve_logistics(
            steps_data=steps_data,
            connections_data=connections_data,
            resource_usage={"crude_oil": 360.0},
            target_outputs={"fuel": 240.0},
            selected_tier=1,
            selected_pipe_tier=1,
            enforce_belt_limit=True,
        )
        self.assertEqual(plan_mk1.pipe_cap, 300.0)
        self.assertEqual(plan_mk1.selected_pipe_tier, 1)
        crude_pipes = [b for b in plan_mk1.belts if b.item_id == "crude_oil"]
        for p in crude_pipes:
            self.assertEqual(p.transport_type, "pipe")
            self.assertLessEqual(p.flow, 300.0 + 1e-4)

        # Mk.2 pipe: cap 600, 360 m³/min fits in 1 pipe lane
        plan_mk2 = solve_logistics(
            steps_data=steps_data,
            connections_data=connections_data,
            resource_usage={"crude_oil": 360.0},
            target_outputs={"fuel": 240.0},
            selected_tier=1,
            selected_pipe_tier=2,
            enforce_belt_limit=True,
        )
        self.assertEqual(plan_mk2.pipe_cap, 600.0)
        self.assertEqual(plan_mk2.selected_pipe_tier, 2)
        crude_pipes_mk2 = [b for b in plan_mk2.belts if b.item_id == "crude_oil"]
        for p in crude_pipes_mk2:
            self.assertEqual(p.transport_type, "pipe")
            self.assertLessEqual(p.flow, 600.0 + 1e-4)

        print("PASS: test_pipeline_fluid_constraints")


if __name__ == "__main__":
    unittest.main()
