"""
Automated unit tests for FastAPI endpoints using TestClient.
"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Satisfactory" in data["title"]

def test_get_items():
    response = client.get("/api/items")
    assert response.status_code == 200
    items = response.json()
    assert len(items) > 0
    assert any(i["id"] == "iron_ore" for i in items)

def test_get_resources():
    response = client.get("/api/resources")
    assert response.status_code == 200
    resources = response.json()
    assert len(resources) > 0
    assert all(r["is_resource"] for r in resources)

def test_get_recipes():
    response = client.get("/api/recipes")
    assert response.status_code == 200
    recipes = response.json()
    assert len(recipes) > 0

def test_solve_resource_constrained():
    payload = {
        "mode": "resource_constrained",
        "resources": {"iron_ore": 720},
        "target_items": ["modular_frame"],
        "max_belt_tier": 3,
        "enforce_belt_limit": True
    }
    response = client.post("/api/solve", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_machines"] > 0
    assert "modular_frame" in data["target_outputs"]
    assert data["logistics"] is not None

def test_solve_target_driven():
    payload = {
        "mode": "target_driven",
        "targets": {"modular_frame": 10},
        "max_belt_tier": 3,
        "enforce_belt_limit": True
    }
    response = client.post("/api/solve", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_machines"] > 0
    assert data["target_outputs"]["modular_frame"] >= 10.0 - 1e-4

def test_solve_compare():
    payload = {
        "mode": "resource_constrained",
        "resources": {"iron_ore": 720},
        "target_items": ["modular_frame"],
        "unlocked_alts": ["Recipe_Alternate_CastScrew_C"],
        "max_belt_tier": 3
    }
    response = client.post("/api/solve/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["variants"]) > 0

def test_solve_pipeline_fluid_logistics():
    payload = {
        "mode": "target_driven",
        "targets": {"modular_frame": 5},
        "max_belt_tier": 2,
        "max_pipe_tier": 1,
        "enforce_belt_limit": True
    }
    response = client.post("/api/solve", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["logistics"] is not None
    assert data["logistics"]["selected_pipe_tier"] == 1
    assert data["logistics"]["pipe_cap"] == 300.0

def test_solve_compare_alt_filter():
    payload = {
        "mode": "resource_constrained",
        "resources": {"iron_ore": 300},
        "target_items": ["modular_frame"],
        "unlocked_alts": ["alternate_cast_screw"],
        "max_belt_tier": 2
    }
    response = client.post("/api/solve/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "variants" in data
    # Ensure variants only use default recipes or the unlocked alt (alternate_cast_screw)
    for v in data["variants"]:
        for r_id in v["recipe_set"]:
            if "alternate" in r_id:
                assert r_id == "alternate_cast_screw"

