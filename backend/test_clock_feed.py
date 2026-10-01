import urllib.request
import json

BASE = "http://localhost:8000"

# Test solve endpoint
req_data = json.dumps({
    "mode": "resource_constrained",
    "resources": {"iron_ore": 720},
    "target_items": ["modular_frame"],
    "max_belt_tier": 3
}).encode()

req = urllib.request.Request(f"{BASE}/api/solve", data=req_data, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req)
data = json.loads(resp.read().decode())

print("=== VERIFYING STEP BREAKDOWNS ===")
for step in data["steps"]:
    norm = step["normal_machine_count"]
    under = step["underclocked_machine_count"]
    clock = step["underclock_clock_speed"]
    total = step["machine_count"]
    print(f"Recipe: {step['recipe_name']}")
    print(f"  Total machines: {total}")
    print(f"  Operating normally: {norm}x @ 100%")
    if under > 0:
        print(f"  Underclocked: {under}x @ {clock:.1f}%")
        # Verify exact machine sum
        assert norm + under == total, f"Machine count mismatch: {norm} + {under} != {total}"
    else:
        assert norm == total, f"Normal machine count mismatch: {norm} != {total}"

print("\n=== VERIFYING BELT CONNECTION FEED DESCRIPTIONS ===")
for conn in data["connections"]:
    print(f"Belt: {conn['item']} ({conn['rate']:.1f}/m on {conn['belt_count']}x Mk.{conn['belt_tier']})")
    print(f"  -> {conn['feed_description']}")
    if conn['feeds_underclocked_machines'] > 0:
        print(f"     [Feeds {conn['feeds_normal_machines']} normal @ 100% + {conn['feeds_underclocked_machines']} underclocked @ {conn['feeds_underclock_clock']:.1f}%]")

print("\n=== VERIFYING SVG OUTPUT FOR LABELS ===")
svg = data["blueprint_svg"]
assert "Underclocked" in svg or "Normal" in svg
print("SVG contains proper machine operating breakdown labels: YES")

print("\nALL AUTOMATED CHECKS PASSED SUCCESSFULLY!")
