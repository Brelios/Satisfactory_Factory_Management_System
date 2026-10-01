import urllib.request
import json

BASE = "http://localhost:8000"

def test_endpoint(name, method, path, body=None):
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")
    try:
        if body:
            data = json.dumps(body).encode()
            req = urllib.request.Request(f"{BASE}{path}", data=data, headers={"Content-Type": "application/json"})
        else:
            req = urllib.request.Request(f"{BASE}{path}")
        r = urllib.request.urlopen(req)
        result = json.loads(r.read())
        return result
    except Exception as e:
        print(f"  ERROR: {e}")
        if hasattr(e, 'read'):
            print(f"  Body: {e.read().decode()}")
        return None

# Test 1: Resource-constrained (existing test)
r = test_endpoint("Resource Constrained: 720 Iron -> Max Modular Frames", "POST", "/api/solve", {
    "mode": "resource_constrained",
    "resources": {"iron_ore": 720},
    "target_items": ["modular_frame"],
    "optimization": "maximize_output"
})
if r:
    print(f"  Output: {r['target_outputs']}")
    print(f"  Machines: {r['total_machines']}, Power: {r['total_power_mw']:.1f} MW")

# Test 2: Target-driven LP (was broken — naive heuristic before)
r2 = test_endpoint("Target Driven LP: 10 Modular Frames/min", "POST", "/api/solve", {
    "mode": "target_driven",
    "targets": {"modular_frame": 10},
    "optimization": "maximize_output"
})
if r2:
    print(f"  Output: {r2['target_outputs']}")
    print(f"  Machines: {r2['total_machines']}, Power: {r2['total_power_mw']:.1f} MW")
    print(f"  Resources needed: {r2['resource_usage']}")
    for s in r2['steps']:
        print(f"    {s['machine_count']}x {s['machine']} ({s['recipe_name']})")

# Test 3: Comparison endpoint
r3 = test_endpoint("Compare: 720 Iron with all recipe variants", "POST", "/api/solve/compare", {
    "mode": "resource_constrained",
    "resources": {"iron_ore": 720},
    "target_items": ["modular_frame"],
    "unlocked_alts": [
        "alternate_cast_screw",
        "alternate_bolted_frame",
        "alternate_steeled_frame"
    ],
    "optimization": "maximize_output"
})
if r3:
    print(f"  Found {len(r3['variants'])} variants!")
    print(f"  Best (fewest machines): {r3['best_machines']}")
    print(f"  Best (lowest power): {r3['best_power']}")
    for v in r3['variants']:
        outputs = v['target_outputs']
        rate = list(outputs.values())[0] if outputs else 0
        print(f"    [{v['label']}]: {rate:.1f}/min, {v['total_machines']} machines, {v['total_power_mw']:.0f} MW")

print("\n\nAll tests complete!")
