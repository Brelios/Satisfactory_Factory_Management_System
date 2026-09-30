import urllib.request, json

# Test API proxy through Next.js
r = urllib.request.urlopen("http://localhost:3000/api/resources")
data = json.loads(r.read())
print(f"API proxy working: {len(data)} resources")
for i in data[:5]:
    print(f"  - {i['display_name']}")

# Test solve through proxy
req_data = json.dumps({
    "mode": "resource_constrained",
    "resources": {"iron_ore": 720, "copper_ore": 240},
    "target_items": ["modular_frame"],
    "optimization": "maximize_output"
}).encode()
req = urllib.request.Request("http://localhost:3000/api/solve", data=req_data, headers={"Content-Type": "application/json"})
r2 = urllib.request.urlopen(req)
result = json.loads(r2.read())
print(f"\nSolve via proxy: {result['total_machines']} machines, {result['total_power_mw']:.0f} MW")
print(f"Output: {result['target_outputs']}")
print("SVG blueprint generated:", "YES" if result["blueprint_svg"] else "NO")
