import urllib.request
import json

BASE = "http://localhost:8000"

# Target driven: 4 Modular Frames / min with max belt tier Mk.2 (120/m)
req_data = json.dumps({
    "mode": "target_driven",
    "targets": {"modular_frame": 4},
    "max_belt_tier": 2
}).encode()

req = urllib.request.Request(f"{BASE}/api/solve", data=req_data, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req)
data = json.loads(resp.read().decode())

print("=== USER SCENARIO TEST: 4 Modular Frames with Mk.2 Belt Cap ===")
for step in data["steps"]:
    print(f"\nMachine: {step['machine']} running {step['recipe_name']}")
    print(f"  Total: {step['machine_count']}")
    print(f"  Breakdown: {step['normal_machine_count']}x @ 100% normal, {step['underclocked_machine_count']}x @ {step['underclock_clock_speed']}% underclocked")
    print(f"  Inputs consumed: {step['input_rates']}")

print("\n--- CONNECTIONS & BELTS ---")
for conn in data["connections"]:
    print(f"Belt carrying {conn['item']} @ {conn['rate']:.1f}/m ({conn['belt_count']}x Mk.{conn['belt_tier']})")
    print(f"  ↳ {conn['feed_description']}")
