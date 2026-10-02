from pydantic import BaseModel, Field
from typing import Literal, Dict, List, Optional
from app.solver.logistics_solver import (
    LogisticsPlan,
    PhysicalMachine,
    PhysicalBelt,
    PhysicalSplitter,
    PhysicalMerger,
    PhysicalMiner,
    ValidationCheck,
    LogisticsValidation,
    TierComparisonRow,
    MachineInput,
    MachineFeeder,
)


class SolveRequest(BaseModel):
    mode: Literal["resource_constrained", "target_driven"]
    resources: Optional[Dict[str, float]] = None
    targets: Optional[Dict[str, float]] = None
    target_items: Optional[List[str]] = None
    unlocked_alts: List[str] = []
    optimization: str = "maximize_output"
    max_belt_tier: Optional[int] = 3
    enforce_belt_limit: bool = True
    remainder_strategy: Literal["merge", "underclock", "dedicated"] = "merge"
    allow_overclock: bool = False
    strict_tier: bool = False


class ProductionStepResponse(BaseModel):
    step_id: str
    recipe_id: str
    recipe_name: str
    machine: str
    machine_count: int
    clock_speed: float
    input_rates: Dict[str, float]
    output_rates: Dict[str, float]
    power_mw: float
    normal_machine_count: int = 0
    underclocked_machine_count: int = 0
    underclock_clock_speed: float = 100.0


class BeltConnectionResponse(BaseModel):
    from_step: str
    to_step: str
    item: str
    rate: float
    belt_tier: int
    belt_count: int = 1
    rate_per_belt: float = 0.0
    feeds_normal_machines: int = 0
    feeds_underclocked_machines: int = 0
    feeds_underclock_clock: float = 100.0
    feed_description: str = ""


class SolveResponse(BaseModel):
    steps: List[ProductionStepResponse]
    connections: List[BeltConnectionResponse]
    blueprint_svg: str
    total_power_mw: float
    total_machines: int
    target_outputs: Dict[str, float]
    resource_usage: Dict[str, float]
    shopping_list: Dict[str, int]
    logistics: Optional[LogisticsPlan] = None


class CompareVariant(BaseModel):
    label: str
    recipe_set: List[str]
    total_machines: int
    total_power_mw: float
    target_outputs: Dict[str, float]
    resource_usage: Dict[str, float]
    shopping_list: Dict[str, int]
    blueprint_svg: str
    steps: List[ProductionStepResponse]
    connections: List[BeltConnectionResponse]
    logistics: Optional[LogisticsPlan] = None


class CompareResponse(BaseModel):
    variants: List[CompareVariant]
    best_machines: str
    best_power: str


class ItemResponse(BaseModel):
    id: str
    display_name: str
    form: str
    is_resource: bool


class RecipeResponse(BaseModel):
    id: str
    display_name: str
    machine: str
    duration: float
    ingredients: List[dict]
    products: List[dict]
    is_alternate: bool


class BuildingResponse(BaseModel):
    id: str
    display_name: str
    power_mw: float
