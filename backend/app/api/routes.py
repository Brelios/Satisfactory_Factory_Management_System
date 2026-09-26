from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.api.schemas import (
    SolveRequest, SolveResponse, ProductionStepResponse, BeltConnectionResponse,
    ItemResponse, RecipeResponse, BuildingResponse
)
from app.data.loader import load_game_data
from app.solver.linear_solver import ProductionSolver
from app.layout.svg_generator import BlueprintGenerator
from app.data.models import GameData, SolveMode, OptimizationGoal

router = APIRouter()

# Global dependency to keep it simple, normally you'd use Depends() or app state
_game_data = None

def get_game_data() -> GameData:
    global _game_data
    if _game_data is None:
        _game_data = load_game_data()
    return _game_data

@router.post("/api/solve", response_model=SolveResponse)
def solve_production(req: SolveRequest):
    game_data = get_game_data()
    solver = ProductionSolver(game_data)
    
    try:
        if req.mode == "resource_constrained":
            if not req.resources or not req.target_items:
                raise HTTPException(status_code=400, detail="Missing resources or target_items for resource_constrained mode")
            result = solver.solve_resource_constrained(
                available_resources=req.resources,
                target_items=req.target_items,
                unlocked_alts=set(req.unlocked_alts) if req.unlocked_alts else None,
                optimization=OptimizationGoal(req.optimization)
            )
        elif req.mode == "target_driven":
            if not req.targets:
                raise HTTPException(status_code=400, detail="Missing targets for target_driven mode")
            result = solver.solve_target_driven(
                targets=req.targets,
                unlocked_alts=set(req.unlocked_alts) if req.unlocked_alts else None,
                optimization=OptimizationGoal(req.optimization)
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid mode")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    svg_gen = BlueprintGenerator(game_data)
    blueprint_svg = svg_gen.generate(result)

    steps = []
    for s in result.steps:
        steps.append(ProductionStepResponse(
            step_id=s.step_id,
            recipe_id=s.recipe_id,
            recipe_name=s.recipe.display_name,
            machine=s.building.display_name,
            machine_count=s.machine_count,
            clock_speed=s.clock_speed,
            input_rates=s.input_rates,
            output_rates=s.output_rates,
            power_mw=s.power_draw
        ))

    connections = []
    for c in result.connections:
        connections.append(BeltConnectionResponse(
            from_step=c.from_step_id,
            to_step=c.to_step_id,
            item=c.item_id,
            rate=c.rate,
            belt_tier=c.belt_tier
        ))

    return SolveResponse(
        steps=steps,
        connections=connections,
        blueprint_svg=blueprint_svg,
        total_power_mw=result.total_power,
        total_machines=result.total_machines,
        target_outputs=result.target_outputs,
        resource_usage=result.resource_usage,
        shopping_list=result.shopping_list
    )

@router.get("/api/items", response_model=List[ItemResponse])
def list_items():
    gd = get_game_data()
    return [ItemResponse(id=i.id, display_name=i.display_name, form=i.form, is_resource=i.is_resource) for i in gd.items.values()]

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
    recipes = gd.recipes.values()
    
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
    return [BuildingResponse(id=b.id, display_name=b.display_name, power_mw=b.power_consumption) for b in gd.buildings.values()]

@router.get("/api/resources", response_model=List[ItemResponse])
def list_resources():
    gd = get_game_data()
    return [ItemResponse(id=i.id, display_name=i.display_name, form=i.form, is_resource=i.is_resource) for i in gd.get_all_resources()]
