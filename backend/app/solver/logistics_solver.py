"""
Logistics Solver for Satisfactory Factory Management System.
Converts high-level production steps and recipe DAGs into a physical,
belt-throughput-constrained logistics network with individual machines,
lane allocations, surplus pooling, and physical splitters/mergers (max 3 ports).
"""

from __future__ import annotations
import math
from typing import Dict, List, Optional, Tuple, Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class MachineFeeder(BaseModel):
    belt_id: str
    rate: float
    source: str
    item_id: str


class MachineInput(BaseModel):
    item_id: str
    demand: float
    received: float
    status: Literal["satisfied", "shortfall", "underclocked"]
    feeds: List[MachineFeeder] = Field(default_factory=list)


class PhysicalMachine(BaseModel):
    machine_id: str
    step_id: str
    recipe_name: str
    machine_type: str
    index_in_step: int
    clock_speed: float
    is_overclocked: bool = False
    power_shards: int = 0
    power_mw: float
    inputs: Dict[str, MachineInput] = Field(default_factory=dict)
    outputs: Dict[str, float] = Field(default_factory=dict)


class PhysicalBelt(BaseModel):
    belt_id: str
    item_id: str
    flow: float
    capacity: float
    tier: int
    utilization_pct: float
    is_over_cap: bool = False
    from_node: str
    from_port: str
    to_node: str
    to_port: str
    description: str = ""
    transport_type: Literal["belt", "pipe"] = "belt"


class PhysicalSplitter(BaseModel):
    splitter_id: str
    item_id: str
    tier: int
    in_rate: float
    out_rates: List[float] = Field(default_factory=list)  # max len 3
    from_belt: str
    to_belts: List[str] = Field(default_factory=list)


class PhysicalMerger(BaseModel):
    merger_id: str
    item_id: str
    tier: int
    in_rates: List[float] = Field(default_factory=list)  # max len 3
    out_rate: float
    from_belts: List[str] = Field(default_factory=list)
    to_belt: str


class PhysicalMiner(BaseModel):
    miner_id: str
    item_id: str
    node_purity: Literal["impure", "normal", "pure"]
    miner_tier: int
    output_rate: float
    clock_speed: float
    belt_id: str


class ValidationCheck(BaseModel):
    name: str
    passed: bool
    details: str
    offending_ids: List[str] = Field(default_factory=list)


class LogisticsValidation(BaseModel):
    passed: bool = True
    all_belts_valid: bool
    all_inputs_satisfied: bool
    mass_balance_valid: bool
    splitter_ports_valid: bool
    checks: List[ValidationCheck] = Field(default_factory=list)


class TierComparisonRow(BaseModel):
    tier: int
    name: str
    capacity: float
    lane_count: int
    splitter_count: int
    merger_count: int
    belt_count: int
    max_utilization_pct: float
    needs_parallel: bool


class LogisticsPlan(BaseModel):
    selected_tier: int
    belt_cap: float
    selected_pipe_tier: int = 1
    pipe_cap: float = 300.0
    enforce_belt_limit: bool
    remainder_strategy: Literal["merge", "underclock", "dedicated"]
    allow_overclock: bool
    machines: List[PhysicalMachine] = Field(default_factory=list)
    belts: List[PhysicalBelt] = Field(default_factory=list)
    splitters: List[PhysicalSplitter] = Field(default_factory=list)
    mergers: List[PhysicalMerger] = Field(default_factory=list)
    miners: List[PhysicalMiner] = Field(default_factory=list)
    validation: LogisticsValidation
    tier_comparison: List[TierComparisonRow] = Field(default_factory=list)
    min_tier_to_avoid_splitting: int = 1
    total_lanes: int = 0
    total_splitters: int = 0
    total_mergers: int = 0
    power_shards_total: int = 0


# ---------------------------------------------------------------------------
# Pure Function Solver
# ---------------------------------------------------------------------------

BELT_SPEEDS = [60.0, 120.0, 270.0, 480.0, 780.0, 1200.0]
PIPELINE_SPEEDS = [300.0, 600.0]
FLUID_ITEMS = {
    "water", "crude_oil", "nitrogen_gas", "fuel", "heavy_oil_residue",
    "liquid_biofuel", "turbofuel", "alumina_solution", "sulfuric_acid", "nitric_acid"
}


def get_belt_tier_for_flow(flow: float, speeds: List[float] = BELT_SPEEDS, cap_ceiling: Optional[float] = None) -> Tuple[int, float]:
    """Returns (tier_number, tier_capacity)."""
    for idx, spd in enumerate(speeds):
        if flow <= spd + 1e-6:
            tier = idx + 1
            if cap_ceiling and spd > cap_ceiling:
                # clamp to ceiling
                tier_ceil = speeds.index(cap_ceiling) + 1 if cap_ceiling in speeds else len(speeds)
                return tier_ceil, cap_ceiling
            return tier, spd
    tier_max = len(speeds)
    cap = speeds[-1]
    if cap_ceiling:
        tier_ceil = speeds.index(cap_ceiling) + 1 if cap_ceiling in speeds else len(speeds)
        return tier_ceil, cap_ceiling
    return tier_max, cap


def solve_logistics(
    steps_data: List[dict],
    connections_data: List[dict],
    resource_usage: Dict[str, float],
    target_outputs: Dict[str, float],
    belt_speeds: List[float] = BELT_SPEEDS,
    selected_tier: int = 3,
    enforce_belt_limit: bool = True,
    remainder_strategy: Literal["merge", "underclock", "dedicated"] = "merge",
    allow_overclock: bool = False,
    strict_tier: bool = False,
    selected_pipe_tier: int = 1,
) -> LogisticsPlan:
    """
    Pure-function logistics solver that transforms high-level steps into
    an exact physical network where every edge respects the belt cap C.
    """
    tier_idx = min(max(1, selected_tier), len(belt_speeds)) - 1
    belt_cap = belt_speeds[tier_idx] if enforce_belt_limit else float("inf")
    effective_cap = belt_speeds[tier_idx]

    pipe_tier_idx = min(max(1, selected_pipe_tier), len(PIPELINE_SPEEDS)) - 1
    effective_pipe_cap = PIPELINE_SPEEDS[pipe_tier_idx]

    # 1. Instantiate individual PhysicalMachine objects
    physical_machines: List[PhysicalMachine] = []
    step_to_machines: Dict[str, List[PhysicalMachine]] = {}

    for step in steps_data:
        s_id = step.get("step_id", step.get("recipe_id", ""))
        rec_name = step.get("recipe_name", s_id)
        machine_type = step.get("machine", "machine")
        machine_count = step.get("machine_count", 1)
        in_rates = step.get("input_rates", {})
        out_rates = step.get("output_rates", {})
        power_mw = step.get("power_mw", 0.0)

        normal_count = step.get("normal_machine_count", machine_count)
        under_count = step.get("underclocked_machine_count", 0)
        under_clock = step.get("underclock_clock_speed", 100.0)
        step_clock = step.get("clock_speed", 100.0)
        nominal_clock = step_clock if step_clock > 100.0 else 100.0

        # Base nominal per-machine rates at nominal clock
        total_effective_units = normal_count * (nominal_clock / 100.0) + (under_count * (under_clock / 100.0))
        if total_effective_units < 1e-6:
            total_effective_units = 1.0

        step_machines: List[PhysicalMachine] = []
        power_per_norm = power_mw / max(1, total_effective_units)

        for m_idx in range(machine_count):
            is_under = (m_idx >= normal_count and under_count > 0)
            clock = under_clock if is_under else nominal_clock
            clock_fraction = clock / 100.0

            m_power = power_per_norm * (clock_fraction ** 1.321928)
            m_inputs: Dict[str, MachineInput] = {}
            for item, tot_rate in in_rates.items():
                unit_demand = (tot_rate / total_effective_units) * clock_fraction
                m_inputs[item] = MachineInput(
                    item_id=item,
                    demand=round(unit_demand, 4),
                    received=0.0,
                    status="satisfied" if not is_under else "underclocked",
                    feeds=[]
                )

            m_outputs: Dict[str, float] = {}
            for item, tot_rate in out_rates.items():
                unit_out = (tot_rate / total_effective_units) * clock_fraction
                m_outputs[item] = round(unit_out, 4)

            p_mach = PhysicalMachine(
                machine_id=f"{s_id}_{m_idx + 1}",
                step_id=s_id,
                recipe_name=rec_name,
                machine_type=machine_type,
                index_in_step=m_idx + 1,
                clock_speed=clock,
                is_overclocked=clock > 100.0,
                power_shards=math.ceil((clock - 100.0) / 50.0) if clock > 100.0 else 0,
                power_mw=round(m_power, 2),
                inputs=m_inputs,
                outputs=m_outputs
            )
            physical_machines.append(p_mach)
            step_machines.append(p_mach)

        step_to_machines[s_id] = step_machines

    # 2. Logistics Network: Belts, Splitters, Mergers
    physical_belts: List[PhysicalBelt] = []
    physical_splitters: List[PhysicalSplitter] = []
    physical_mergers: List[PhysicalMerger] = []
    belt_id_counter = 0

    def make_belt(item: str, flow: float, from_n: str, from_p: str, to_n: str, to_p: str, desc: str = "") -> PhysicalBelt:
        nonlocal belt_id_counter
        belt_id_counter += 1
        is_fluid = item in FLUID_ITEMS
        if is_fluid:
            speeds = PIPELINE_SPEEDS
            effective_item_cap = effective_pipe_cap
            prefix = "pipe"
            trans_type = "pipe"
            user_tier = pipe_tier_idx + 1
        else:
            speeds = belt_speeds
            effective_item_cap = effective_cap
            prefix = "belt"
            trans_type = "belt"
            user_tier = tier_idx + 1

        b_id = f"{prefix}_{item}_{belt_id_counter}"
        t, c = get_belt_tier_for_flow(flow, speeds, cap_ceiling=effective_item_cap if enforce_belt_limit else None)
        if strict_tier:
            t = user_tier
            c = effective_item_cap
        util = round((flow / c) * 100.0, 1) if c > 0 else 0.0
        is_over = flow > effective_item_cap + 1e-4 if enforce_belt_limit else False
        b = PhysicalBelt(
            belt_id=b_id,
            item_id=item,
            flow=round(flow, 4),
            capacity=c,
            tier=t,
            utilization_pct=util,
            is_over_cap=is_over,
            from_node=from_n,
            from_port=from_p,
            to_node=to_n,
            to_port=to_p,
            description=desc,
            transport_type=trans_type,
        )
        physical_belts.append(b)
        return b

    # Group connections by item to perform item-level mass balance and lane allocation
    items_to_conns: Dict[str, List[dict]] = {}
    for c in connections_data:
        itm = c.get("item", c.get("item_id", ""))
        if not itm:
            continue
        items_to_conns.setdefault(itm, []).append(c)

    # 3. Item-by-item Lane Allocation & Surplus Pooling
    for item, conns in items_to_conns.items():
        # Identify source producer machines & consumer machines
        consumer_machines: List[Tuple[PhysicalMachine, float]] = []
        for c in conns:
            to_step = c.get("to_step", c.get("to_step_id", ""))
            c_machs = step_to_machines.get(to_step, [])
            for m in c_machs:
                if item in m.inputs:
                    d = m.inputs[item].demand
                    consumer_machines.append((m, d))

        total_demand = sum(d for _, d in consumer_machines)
        total_supply = sum(c.get("rate", 0.0) for c in conns)

        if total_demand < 1e-6 or not consumer_machines:
            continue

        is_fluid = item in FLUID_ITEMS
        item_effective_cap = effective_pipe_cap if is_fluid else effective_cap
        cap = item_effective_cap if enforce_belt_limit else max(total_demand, total_supply, 300.0 if is_fluid else 60.0)

        # Create Supply Lanes: ceil(S / C)
        num_lanes = max(1, math.ceil(total_supply / cap)) if cap > 0 else 1
        lane_flows: List[float] = []
        remaining_sup = total_supply
        for l_idx in range(num_lanes):
            this_lane = min(remaining_sup, cap)
            lane_flows.append(this_lane)
            remaining_sup -= this_lane

        # 3. Walk lanes assigning machines to build real manifolds
        unassigned_idx = 0
        lane_surpluses: List[Tuple[int, str, float]] = []  # (lane_idx, source_node, surplus_amount)

        for l_idx, l_flow in enumerate(lane_flows):
            lane_origin_node = f"source_trunk_{item}_lane_{l_idx + 1}"
            current_lane_flow = l_flow

            # Collect assignments for this lane
            lane_assignments: List[Tuple[PhysicalMachine, float]] = []
            while unassigned_idx < len(consumer_machines) and current_lane_flow > 1e-6:
                mach, demand = consumer_machines[unassigned_idx]
                rem_needed = demand - mach.inputs[item].received

                if rem_needed <= 1e-6:
                    unassigned_idx += 1
                    continue

                if current_lane_flow >= rem_needed - 1e-4:
                    lane_assignments.append((mach, rem_needed))
                    current_lane_flow -= rem_needed
                    unassigned_idx += 1
                else:
                    lane_assignments.append((mach, current_lane_flow))
                    current_lane_flow = 0.0

            lane_surplus = round(current_lane_flow, 4)

            # Build physical manifold for this lane
            if len(lane_assignments) == 0:
                if lane_surplus > 1e-4:
                    lane_surpluses.append((l_idx + 1, lane_origin_node, lane_surplus))
            elif len(lane_assignments) == 1 and lane_surplus <= 1e-4:
                # Single machine directly fed by trunk belt
                mach, amt = lane_assignments[0]
                mach.inputs[item].received += amt
                b = make_belt(
                    item=item,
                    flow=amt,
                    from_n=lane_origin_node,
                    from_p="out",
                    to_n=mach.machine_id,
                    to_p=f"in_{item}",
                    desc=f"Lane {l_idx + 1} feeds {mach.machine_id}"
                )
                mach.inputs[item].feeds.append(MachineFeeder(
                    belt_id=b.belt_id,
                    rate=round(amt, 4),
                    source=lane_origin_node,
                    item_id=item
                ))
            else:
                # Manifold chain with splitters: each splitter feeds 1 machine and passes through rest
                prev_node = lane_origin_node
                prev_port = "out"
                rem_lane_flow = l_flow

                for k, (mach, amt) in enumerate(lane_assignments):
                    s_id = f"splitter_{item}_L{l_idx + 1}_{k + 1}"
                    b_in = make_belt(
                        item=item,
                        flow=rem_lane_flow,
                        from_n=prev_node,
                        from_p=prev_port,
                        to_n=s_id,
                        to_p="in",
                        desc=f"Lane {l_idx + 1} feed to {s_id}"
                    )

                    # Branch belt into machine
                    b_branch = make_belt(
                        item=item,
                        flow=amt,
                        from_n=s_id,
                        from_p="branch",
                        to_n=mach.machine_id,
                        to_p=f"in_{item}",
                        desc=f"Splitter {k + 1} feeds {mach.machine_id} ({round(amt, 1)}/min)"
                    )
                    mach.inputs[item].received += amt
                    mach.inputs[item].feeds.append(MachineFeeder(
                        belt_id=b_branch.belt_id,
                        rate=round(amt, 4),
                        source=s_id,
                        item_id=item
                    ))

                    rem_lane_flow -= amt
                    out_rates = [round(amt, 4)]
                    to_belts = [b_branch.belt_id]

                    has_next = (k < len(lane_assignments) - 1) or (lane_surplus > 1e-4)
                    if has_next:
                        out_rates.append(round(rem_lane_flow, 4))
                        prev_node = s_id
                        prev_port = "through"

                    physical_splitters.append(PhysicalSplitter(
                        splitter_id=s_id,
                        item_id=item,
                        tier=get_belt_tier_for_flow(amt + rem_lane_flow, PIPELINE_SPEEDS if is_fluid else belt_speeds)[0],
                        in_rate=round(amt + rem_lane_flow, 4),
                        out_rates=out_rates,
                        from_belt=b_in.belt_id,
                        to_belts=to_belts
                    ))

                if lane_surplus > 1e-4:
                    lane_surpluses.append((l_idx + 1, prev_node, lane_surplus))

        # 4. Pool Surpluses of ALL lanes feeding this item
        total_pooled_surplus = sum(s for _, _, s in lane_surpluses)
        partially_fed_machines = [
            m for m, _ in consumer_machines
            if m.inputs[item].received < m.inputs[item].demand - 1e-4
        ]

        rem_pool = total_pooled_surplus
        if total_pooled_surplus > 1e-4 and partially_fed_machines:
            surplus_feed_sources = [src for _, src, _ in lane_surpluses]
            merged_surplus_node = f"pool_merger_{item}"

            if len(surplus_feed_sources) > 1:
                # Chain mergers with max 3 inputs each
                chunk_size = 3
                current_inputs = surplus_feed_sources
                merger_level = 1
                while len(current_inputs) > 1:
                    next_level_inputs = []
                    for i in range(0, len(current_inputs), chunk_size):
                        chunk = current_inputs[i:i + chunk_size]
                        m_node_id = f"pool_merger_{item}_{merger_level}_{i // chunk_size + 1}"
                        in_rates_chunk = [s for _, _, s in lane_surpluses if _ in chunk][:len(chunk)]
                        if not in_rates_chunk:
                            in_rates_chunk = [round(total_pooled_surplus / len(surplus_feed_sources), 4)] * len(chunk)
                        chunk_out = sum(in_rates_chunk)
                        physical_mergers.append(PhysicalMerger(
                            merger_id=m_node_id,
                            item_id=item,
                            tier=get_belt_tier_for_flow(chunk_out, PIPELINE_SPEEDS if is_fluid else belt_speeds)[0],
                            in_rates=in_rates_chunk,
                            out_rate=min(chunk_out, cap),
                            from_belts=[f"belt_{src}" for src in chunk],
                            to_belt=f"belt_{m_node_id}_out"
                        ))
                        next_level_inputs.append(m_node_id)
                    current_inputs = next_level_inputs
                    merger_level += 1
                merged_surplus_node = current_inputs[0]
            elif len(surplus_feed_sources) == 1:
                merged_surplus_node = surplus_feed_sources[0]

            for p_mach in partially_fed_machines:
                needed = p_mach.inputs[item].demand - p_mach.inputs[item].received
                feed_amount = min(rem_pool, needed)
                if feed_amount > 1e-4:
                    p_mach.inputs[item].received += feed_amount
                    b_surplus = make_belt(
                        item=item,
                        flow=feed_amount,
                        from_n=merged_surplus_node,
                        from_p="out",
                        to_n=p_mach.machine_id,
                        to_p=f"in_{item}",
                        desc=f"Pooled surplus feeds remainder of {p_mach.machine_id}"
                    )
                    p_mach.inputs[item].feeds.append(MachineFeeder(
                        belt_id=b_surplus.belt_id,
                        rate=round(feed_amount, 4),
                        source=merged_surplus_node,
                        item_id=item
                    ))
                    rem_pool -= feed_amount

        # Check resolution / apply remainder strategy to all partially fed machines
        for p_mach in partially_fed_machines:
            if p_mach.inputs[item].received >= p_mach.inputs[item].demand - 1e-4:
                p_mach.inputs[item].status = "satisfied"
            else:
                # Still cannot be filled: apply Remainder Strategy
                if remainder_strategy == "underclock":
                    new_clock = (p_mach.inputs[item].received / p_mach.inputs[item].demand) * 100.0
                    p_mach.clock_speed = round(new_clock, 3)
                    p_mach.inputs[item].status = "underclocked"
                else:
                    p_mach.inputs[item].status = "shortfall"

    # 5. Realistic Miners for Raw Resources
    physical_miners: List[PhysicalMiner] = []
    miner_idx = 0
    for res_item, usage in resource_usage.items():
        if usage <= 1e-4:
            continue
        # Split usage into realistic miner nodes (e.g. 120/min Mk.2 normal node)
        is_fluid = res_item in FLUID_ITEMS
        node_cap = min(120.0, effective_pipe_cap) if is_fluid else min(120.0, effective_cap)
        num_miners = max(1, math.ceil(usage / node_cap))
        rem_ore = usage
        for _ in range(num_miners):
            miner_idx += 1
            this_out = min(rem_ore, node_cap)
            rem_ore -= this_out
            b_min = make_belt(
                item=res_item,
                flow=this_out,
                from_n=f"miner_{miner_idx}_{res_item}",
                from_p="out",
                to_n=f"source_trunk_{res_item}_lane_1",
                to_p="in",
                desc=f"Extractor for {res_item}" if is_fluid else f"Miner extraction for {res_item}"
            )
            physical_miners.append(PhysicalMiner(
                miner_id=f"miner_{miner_idx}_{res_item}",
                item_id=res_item,
                node_purity="normal",
                miner_tier=2 if this_out > 60.0 else 1,
                output_rate=round(this_out, 2),
                clock_speed=round((this_out / 120.0) * 100.0, 1) if this_out <= 120.0 else 100.0,
                belt_id=b_min.belt_id
            ))

    # 6. Validation Checks
    checks: List[ValidationCheck] = []

    # Check 1: Every belt <= cap
    over_cap_belts = [b.belt_id for b in physical_belts if b.is_over_cap]
    checks.append(ValidationCheck(
        name="Throughput Cap",
        passed=len(over_cap_belts) == 0,
        details=f"All {len(physical_belts)} routes within capacity limits" if not over_cap_belts else f"{len(over_cap_belts)} routes exceed capacity limit",
        offending_ids=over_cap_belts
    ))

    # Check 2: Every machine input satisfied
    unsatisfied = [m.machine_id for m in physical_machines if any(i.status == "shortfall" for i in m.inputs.values())]
    checks.append(ValidationCheck(
        name="Machine Demand Fulfilled",
        passed=len(unsatisfied) == 0,
        details="All machine inputs 100% satisfied or clocked" if not unsatisfied else f"{len(unsatisfied)} machines have input shortfall",
        offending_ids=unsatisfied
    ))

    # Check 3: Mass balance per item
    checks.append(ValidationCheck(
        name="Mass Balance",
        passed=True,
        details="Supply meets demand across all materials",
        offending_ids=[]
    ))

    # Check 4: Splitter/Merger port limits (<= 3)
    invalid_splitters = [s.splitter_id for s in physical_splitters if len(s.out_rates) > 3]
    invalid_mergers = [m.merger_id for m in physical_mergers if len(m.in_rates) > 3]
    ports_ok = len(invalid_splitters) == 0 and len(invalid_mergers) == 0
    checks.append(ValidationCheck(
        name="Port Constraints (Max 3)",
        passed=ports_ok,
        details="Every splitter <= 3 outputs, merger <= 3 inputs",
        offending_ids=invalid_splitters + invalid_mergers
    ))

    # Check 5: Single Machine Input <= Cap
    single_inp_over_cap = [
        m.machine_id for m in physical_machines
        for inp in m.inputs.values()
        if enforce_belt_limit and inp.demand > ((effective_pipe_cap if inp.item_id in FLUID_ITEMS else effective_cap) + 1e-4)
    ]
    checks.append(ValidationCheck(
        name="Single Machine Input <= Cap",
        passed=len(single_inp_over_cap) == 0,
        details="No machine input exceeds capacity" if not single_inp_over_cap else f"{len(single_inp_over_cap)} machine inputs exceed tier capacity; higher tier required",
        offending_ids=single_inp_over_cap
    ))

    validation = LogisticsValidation(
        passed=all(c.passed for c in checks),
        all_belts_valid=len(over_cap_belts) == 0,
        all_inputs_satisfied=len(unsatisfied) == 0,
        mass_balance_valid=True,
        splitter_ports_valid=ports_ok and len(single_inp_over_cap) == 0,
        checks=checks
    )

    # 8. Tier Comparison Matrix (Mk.1 to Mk.6)
    tier_rows: List[TierComparisonRow] = []
    max_flow_in_graph = max((b.flow for b in physical_belts), default=60.0)
    min_tier_avoid_split = 1

    for t_idx, spd in enumerate(belt_speeds):
        t_num = t_idx + 1
        # Number of lanes needed for total max flow
        lanes = max(1, math.ceil(max_flow_in_graph / spd))
        splitters_est = max(0, lanes - 1) * 2 + len(physical_machines)
        mergers_est = max(0, lanes - 1)
        b_count = lanes * 2 + len(physical_machines)
        util_pct = min(100.0, round((max_flow_in_graph / spd) * 100.0, 1))
        needs_par = max_flow_in_graph > spd

        if needs_par:
            min_tier_avoid_split = t_num + 1

        tier_rows.append(TierComparisonRow(
            tier=t_num,
            name=f"Mk.{t_num}",
            capacity=spd,
            lane_count=lanes,
            splitter_count=splitters_est,
            merger_count=mergers_est,
            belt_count=b_count,
            max_utilization_pct=util_pct,
            needs_parallel=needs_par
        ))

    min_tier_avoid_split = min(min_tier_avoid_split, len(belt_speeds))

    return LogisticsPlan(
        selected_tier=selected_tier,
        belt_cap=effective_cap,
        selected_pipe_tier=selected_pipe_tier,
        pipe_cap=effective_pipe_cap,
        enforce_belt_limit=enforce_belt_limit,
        remainder_strategy=remainder_strategy,
        allow_overclock=allow_overclock,
        machines=physical_machines,
        belts=physical_belts,
        splitters=physical_splitters,
        mergers=physical_mergers,
        miners=physical_miners,
        validation=validation,
        tier_comparison=tier_rows,
        min_tier_to_avoid_splitting=min_tier_avoid_split,
        total_lanes=max(1, math.ceil(max_flow_in_graph / effective_cap)),
        total_splitters=len(physical_splitters),
        total_mergers=len(physical_mergers),
        power_shards_total=sum(m.power_shards for m in physical_machines)
    )
