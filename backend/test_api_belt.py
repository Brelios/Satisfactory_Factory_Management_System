import urllib.request
import json

BASE = "http://localhost:8000"

def test_solve(max_belt_tier):
    data = json.dumps({
        "mode": "resource_constrained",
        "resources": {"iron_ore": 720},
        "target_items": ["modular_frame"],
        "max_belt_tier": max_belt_tier
    }).encode()
    req = urllib.request.Request(f"{BASE}/api/solve", data=data, headers={"Content-Type": "application/json"})
    r = urllib.request.urlopen(req)
    res = json.loads(r.read())
    return res

print("Testing API solve without belt limit (Unconstrained)...")
r_un = test_solve(None)
print(f"Total machines: {r_un['total_machines']}")
print(f"Splitters/Mergers: {r_un['shopping_list'].get('Conveyor Splitter / Merger (est.)')}")
for c in r_un['connections']:
    print(f"  {c['item']}: {c['rate']:.1f}/m -> {c['belt_count']}x Mk.{c['belt_tier']}")

print("\nTesting API solve with Mk.3 belt limit (270/min)...")
r_mk3 = test_solve(3)
print(f"Total machines: {r_mk3['total_machines']}")
print(f"Splitters/Mergers: {r_mk3['shopping_list'].get('Conveyor Splitter / Merger (est.)')}")
for c in r_mk3['connections']:
    print(f"  {c['item']}: {c['rate']:.1f}/m -> {c['belt_count']}x Mk.{c['belt_tier']}")
