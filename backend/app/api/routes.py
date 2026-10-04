from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.api.schemas import (
    SolveRequest, SolveResponse, ProductionStepResponse, BeltConnectionResponse,
    ItemResponse, RecipeResponse, BuildingResponse,
    CompareResponse, CompareVariant
)
from app.data.loader import load_game_data
from app.solver.linear_solver import ProductionSolver
from app.layout.svg_generator import BlueprintGenerator
from app.data.models import GameData, OptimizationGoal

router = APIRouter()

_game_data = None


def get_game_data() -> GameData:
    global _game_data
    if _game_data is None:
        _game_data = load_game_data()
    return _game_data


def _build_step_responses(result) -> List[ProductionStepResponse]:
    return [ProductionStepResponse(
        step_id=s.step_id,
        recipe_id=s.recipe_id,
        recipe_name=s.recipe.display_name,
        machine=s.building.display_name,
        machine_count=s.machine_count,
        clock_speed=s.clock_speed,
        input_rates=s.input_rates,
        output_rates=s.output_rates,
        power_mw=s.power_draw,
        normal_machine_count=s.normal_machine_count,
        underclocked_machine_count=s.underclocked_machine_count,
        underclock_clock_speed=s.underclock_clock_speed,
    ) for s in result.steps]


def _build_conn_responses(result) -> List[BeltConnectionResponse]:
    return [BeltConnectionResponse(
        from_step=c.from_step_id,
        to_step=c.to_step_id,
        item=c.item_id,
        rate=c.rate,
        belt_tier=c.belt_tier,
        belt_count=c.belt_count,
        rate_per_belt=c.rate_per_belt,
        feeds_normal_machines=c.feeds_normal_machines,
        feeds_underclocked_machines=c.feeds_underclocked_machines,
        feeds_underclock_clock=c.feeds_underclock_clock,
        feed_description=c.feed_description,
    ) for c in result.connections]


@router.post("/api/solve", response_model=SolveResponse)
def solve_production(req: SolveRequest):
    game_data = get_game_data()
    solver = ProductionSolver(game_data)

    try:
        if req.mode == "resource_constrained":
            if not req.resources or not req.target_items:
                raise HTTPException(
                    status_code=400,
                    detail="Missing resources or target_items for resource_constrained mode"
                )
            result = solver.solve_resource_constrained(
                available_resources=req.resources,
                target_items=req.target_items,
                unlocked_alts=set(req.unlocked_alts) if req.unlocked_alts else None,
                optimization=OptimizationGoal(req.optimization),
                max_belt_tier=req.max_belt_tier,
            )
        elif req.mode == "target_driven":
            if not req.targets:
                raise HTTPException(
                    status_code=400,
                    detail="Missing targets for target_driven mode"
                )
            result = solver.solve_target_driven(
                targets=req.targets,
                unlocked_alts=set(req.unlocked_alts) if req.unlocked_alts else None,
                optimization=OptimizationGoal(req.optimization),
                max_belt_tier=req.max_belt_tier,
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid mode")

        if not result.steps:
            raise HTTPException(
                status_code=422,
                detail="Solver found no feasible production plan. Check that your resources can produce the target items."
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solver error: {str(e)}")

    svg_gen = BlueprintGenerator(game_data)
    blueprint_svg = svg_gen.generate(result)

    step_resps = _build_step_responses(result)
    conn_resps = _build_conn_responses(result)

    from app.solver.logistics_solver import solve_logistics
    logistics_plan = solve_logistics(
        steps_data=[s.model_dump() for s in step_resps],
        connections_data=[c.model_dump() for c in conn_resps],
        resource_usage=result.resource_usage,
        target_outputs=result.target_outputs,
        belt_speeds=game_data.belt_speeds,
        selected_tier=req.max_belt_tier or 3,
        enforce_belt_limit=req.enforce_belt_limit,
        remainder_strategy=req.remainder_strategy,
        allow_overclock=req.allow_overclock,
        strict_tier=req.strict_tier,
        selected_pipe_tier=req.max_pipe_tier or 1,
    )

    shopping_list = dict(result.shopping_list)
    total_power_shards = sum(m.power_shards for m in logistics_plan.machines)
    if total_power_shards > 0:
        shopping_list["Power Shard"] = total_power_shards

    return SolveResponse(
        steps=step_resps,
        connections=conn_resps,
        blueprint_svg=blueprint_svg,
        total_power_mw=result.total_power,
        total_machines=result.total_machines,
        target_outputs=result.target_outputs,
        resource_usage=result.resource_usage,
        shopping_list=shopping_list,
        logistics=logistics_plan,
    )


@router.post("/api/solve/compare", response_model=CompareResponse)
def solve_compare(req: SolveRequest):
    """Generate multiple blueprint variants with different recipe combinations."""
    game_data = get_game_data()
    solver = ProductionSolver(game_data)
    svg_gen = BlueprintGenerator(game_data)

    try:
        variants_raw = solver.solve_compare(
            available_resources=req.resources,
            targets=req.targets,
            target_items=req.target_items,
            unlocked_alts=set(req.unlocked_alts) if req.unlocked_alts else None,
            optimization=OptimizationGoal(req.optimization),
            max_belt_tier=req.max_belt_tier,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison error: {str(e)}")

    if not variants_raw:
        raise HTTPException(
            status_code=422,
            detail="No feasible production plans found for any recipe combination."
        )

    from app.solver.logistics_solver import solve_logistics
    variants = []
    for v in variants_raw:
        res = v["result"]
        blueprint_svg = svg_gen.generate(res)
        step_resps = _build_step_responses(res)
        conn_resps = _build_conn_responses(res)
        v_logistics = solve_logistics(
            steps_data=[s.model_dump() for s in step_resps],
            connections_data=[c.model_dump() for c in conn_resps],
            resource_usage=res.resource_usage,
            target_outputs=res.target_outputs,
            belt_speeds=game_data.belt_speeds,
            selected_tier=req.max_belt_tier or 3,
            enforce_belt_limit=req.enforce_belt_limit,
            remainder_strategy=req.remainder_strategy,
            allow_overclock=req.allow_overclock,
            strict_tier=req.strict_tier,
            selected_pipe_tier=req.max_pipe_tier or 1,
        )
        v_shop = dict(res.shopping_list)
        v_shards = sum(m.power_shards for m in v_logistics.machines)
        if v_shards > 0:
            v_shop["Power Shard"] = v_shards

        variants.append(CompareVariant(
            label=v["label"],
            recipe_set=v["recipe_set"],
            total_machines=res.total_machines,
            total_power_mw=res.total_power,
            target_outputs=res.target_outputs,
            resource_usage=res.resource_usage,
            shopping_list=v_shop,
            blueprint_svg=blueprint_svg,
            steps=step_resps,
            connections=conn_resps,
            logistics=v_logistics,
        ))

    # Find best variants
    best_machines = min(variants, key=lambda v: v.total_machines).label if variants else ""
    best_power = min(variants, key=lambda v: v.total_power_mw).label if variants else ""

    return CompareResponse(
        variants=variants,
        best_machines=best_machines,
        best_power=best_power,
    )


@router.get("/api/items", response_model=List[ItemResponse])
def list_items():
    gd = get_game_data()
    return [ItemResponse(id=i.id, display_name=i.display_name, form=i.form, is_resource=i.is_resource)
            for i in gd.items.values()]


@router.get("/api/items/{item_id}", response_model=ItemResponse)
def get_item(item_id: str):
    gd = get_game_data()
    if item_id not in gd.items:
        raise HTTPException(status_code=404, detail="Item not found")
    i = gd.items[item_id]
    return ItemResponse(id=i.id, display_name=i.display_name, form=i.form, is_resource=i.is_resource)


@router.get("/api/recipes", response_model=List[RecipeResponse])
def list_recipes(item: Optional[str] = None, alts: Optional[bool] = None):
    gd = get_game_data()
    recipes = list(gd.recipes.values())

    if item:
        recipes = [r for r in recipes if any(p.item_id == item for p in r.products)]
    if alts is not None:
        recipes = [r for r in recipes if r.is_alternate == alts]

    return [RecipeResponse(
        id=r.id, display_name=r.display_name, machine=r.machine_id, duration=r.duration,
        ingredients=[{"item_id": i.item_id, "amount": i.amount} for i in r.ingredients],
        products=[{"item_id": p.item_id, "amount": p.amount} for p in r.products],
        is_alternate=r.is_alternate
    ) for r in recipes]


@router.get("/api/recipes/{id}", response_model=RecipeResponse)
def get_recipe(id: str):
    gd = get_game_data()
    if id not in gd.recipes:
        raise HTTPException(status_code=404, detail="Recipe not found")
    r = gd.recipes[id]
    return RecipeResponse(
        id=r.id, display_name=r.display_name, machine=r.machine_id, duration=r.duration,
        ingredients=[{"item_id": i.item_id, "amount": i.amount} for i in r.ingredients],
        products=[{"item_id": p.item_id, "amount": p.amount} for p in r.products],
        is_alternate=r.is_alternate
    )


@router.get("/api/buildings", response_model=List[BuildingResponse])
def list_buildings():
    gd = get_game_data()
    return [BuildingResponse(id=b.id, display_name=b.display_name, power_mw=b.power_consumption)
            for b in gd.buildings.values()]


@router.get("/api/resources", response_model=List[ItemResponse])
def list_resources():
    gd = get_game_data()
    return [ItemResponse(id=i.id, display_name=i.display_name, form=i.form, is_resource=i.is_resource)
            for i in gd.get_all_resources()]
