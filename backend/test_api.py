import urllib.request, json

data = json.dumps({
    "mode": "resource_constrained",
    "resources": {"iron_ore": 720, "copper_ore": 240},
    "target_items": ["modular_frame"],
    "optimization": "maximize_output"
}).encode()

req = urllib.request.Request(
    "http://localhost:8000/api/solve",
    data=data,
    headers={"Content-Type": "application/json"}
)
r = urllib.request.urlopen(req)
result = json.loads(r.read().decode())

print("=== SOLVE RESULT ===")
pw = result["total_power_mw"]
print(f"Total Power: {pw:.1f} MW")
print(f"Total Machines: {result['total_machines']}")
print(f"Target Outputs: {result['target_outputs']}")
print(f"Resources Used: {result['resource_usage']}")
print(f"Shopping List: {result['shopping_list']}")
print(f"SVG Size: {len(result['blueprint_svg'])} chars")
print()
print("Steps:")
for s in result["steps"]:
    mc = s["machine_count"]
    mn = s["machine"]
    rn = s["recipe_name"]
    out = s["output_rates"]
    clk = s["clock_speed"]
    print(f"  {mc}x {mn} ({rn}): out={out}, clock={clk:.1f}%")
