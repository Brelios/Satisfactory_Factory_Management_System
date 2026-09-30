# 🏭 Satisfactory Factory Management System

A mathematical production solver and interactive visual blueprint generator for **Satisfactory**. Input your available mining resource rates, and the system computes the exact, mathematically optimal factory layout — machine counts, recipes, clock speeds, belt tiers, and power requirements — then renders it as an engineering schematic blueprint.

---

## ⚡ Features

- **Resource-Constrained Solver** — *"I have 720 Iron Ore and 240 Copper Ore per minute. What's the maximum Modular Frames I can produce?"*
- **Target-Driven Solver** — *"I want exactly 10 Modular Frames/min. What raw ore nodes and intermediate machines do I need?"*
- **Mathematical Linear Programming** — Uses `scipy.optimize.linprog` to guarantee exact optimal production balance without rounding guesswork or starvation bottlenecks.
- **2D Schematic Blueprint Generator** — Renders clean SVG flow schematics with machine counts, underclocking percentages, manifold connections, and color-coded belt tiers (Mk.1 – Mk.6).
- **Alternative Recipe Optimization** — Toggle unlocked Alternate Recipes (e.g., Cast Screws, Steeled Frames, Iron Wire) to drastically simplify logistics or eliminate intermediate dependencies.
- **Bill of Materials / Shopping List** — Tally total constructors, assemblers, splitters, power consumption in MW, and belt tiers before placing a single foundation in-game.
- **REST API + Modern Web UI** — FastAPI backend with interactive Swagger documentation paired with a high-performance Next.js & Tailwind CSS frontend.

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14+ / React / TypeScript / Tailwind CSS) │
│  • Resource Input Panel   • SVG Blueprint Canvas (Zoom/Pan) │
│  • Target Selector        • Shopping List & Power Budget    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / Proxy (:3000 -> :8000)
┌──────────────────────────────▼──────────────────────────────┐
│  Backend (Python FastAPI)                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐│
│  │ Linear Solver    │  │ Recipe Graph     │  │ SVG Engine  ││
│  │ (scipy linprog)  │  │ (NetworkX DAG)   │  │ (Schematic) ││
│  └──────────────────┘  └──────────────────┘  └─────────────┘│
│  Game Data Layer: Satisfactory 1.0 Recipes, Items & Machines │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 Prerequisites

Ensure you have the following installed on your machine:

1. **Git**: [Download Git](https://git-scm.com/downloads)
2. **Python 3.11+**: [Download Python](https://www.python.org/downloads/) *(Make sure to check "Add Python to PATH" during installation on Windows)*
3. **Node.js 18+ & npm**: [Download Node.js](https://nodejs.org/)

---

## 🚀 Quick Start / Local Installation

Clone the repository to your local machine:

```bash
git clone https://github.com/Brelios/Satisfactory_Factory_Management_System.git
cd Satisfactory_Factory_Management_System
```

### 1. Set Up & Start the Backend

Open a terminal in the project root:

#### Windows (PowerShell / Command Prompt)
```powershell
# Navigate to the backend directory
cd backend

# Create a virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# In PowerShell:
.\venv\Scripts\Activate.ps1
# (Or in CMD):
# .\venv\Scripts\activate.bat

# Install dependencies in editable mode
pip install -e ".[dev]"

# Start the FastAPI server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### macOS / Linux
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Start the FastAPI server
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend API will start at:
- **API URL**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`

---

### 2. Set Up & Start the Frontend

Open a **second terminal window** in the project root:

```bash
# Navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Start the Next.js development server
npm run dev
```

The web dashboard is now accessible at:
👉 **`http://localhost:3000`**

*(Requests from the frontend to `/api/*` are automatically proxied to the Python backend on port 8000).*

---

## 🎮 How to Use

1. **Choose Your Planning Mode**:
   - **Max Output (Resource Constrained)**: Enter the exact output of your miners (e.g., 720 Iron Ore from an Overclocked Pure Node on a Mk.5 Belt) and select target products to maximize.
   - **Target Driven**: Specify target production quotas (e.g., 10 Modular Frames/min) to calculate exactly how much raw ore and intermediate processing is required.
2. **Configure Resources & Target Parts**:
   - Add multiple raw inputs (Iron Ore, Copper Ore, Coal, Limestone, etc.).
   - Pick the components you wish to produce.
3. **Solve Blueprint**:
   - Click **SOLVE BLUEPRINT**.
   - The engine instantly calculates:
     - **Machine Counts & Underclocking**: Exact numbers of Smelters, Constructors, and Assemblers (including clock speed % for edge machines).
     - **Power Grid Budget**: Total MW required to run the line.
     - **Logistics & Belt Tiers**: Minimum conveyor speeds (Mk.1 through Mk.6) required per connection.
     - **2D Schematic**: A complete visual factory floorplan diagram ready to follow in-game.

---

## 🛠️ API Usage Example

You can also use the backend directly as a standalone headless service or CLI:

```bash
curl -X POST http://localhost:8000/api/solve \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "resource_constrained",
    "resources": {
      "iron_ore": 720
    },
    "target_items": ["modular_frame"],
    "optimization": "maximize_output"
  }'
```

**Response Output Preview:**
- **Max Output**: `30.0 Modular Frames/min`
- **Total Machines**: `97` (24 Smelters, 21 Rod Constructors, 14 Plate Constructors, 14 Screw Constructors, 9 RIP Assemblers, 15 Frame Assemblers)
- **Power Budget**: `647.2 MW`
- **Blueprint**: Full vectorized SVG schema payload.

---

## 📁 Repository Structure

```
Satisfactory_Factory_Management_System/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI application entry point & CORS
│   │   ├── api/
│   │   │   ├── schemas.py           # Pydantic v2 validation models
│   │   │   └── routes.py            # API endpoints (/api/solve, /api/items, etc.)
│   │   ├── data/
│   │   │   ├── models.py            # Core dataclasses (Item, Recipe, Building)
│   │   │   ├── loader.py            # Game data parser & singleton manager
│   │   │   └── game_data/data.json  # Comprehensive Satisfactory 1.0 recipe dataset
│   │   ├── solver/
│   │   │   ├── recipe_graph.py      # NetworkX DAG builder & cycle resolution
│   │   │   ├── linear_solver.py     # SciPy linear programming production optimizer
│   │   │   └── rate_calculator.py   # Machine rounding, clocking & belt tier selection
│   │   └── layout/
│   │       └── svg_generator.py     # SVG schematic generation engine
│   ├── pyproject.toml               # Python package configuration
│   └── test_api.py                  # Integration verification script
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Interactive dashboard (Inputs, SVG Viewer, Tables)
│   │   │   ├── layout.tsx           # Dark theme layout shell
│   │   │   └── globals.css          # Tailwind CSS & blueprint styling
│   │   ├── components/
│   │   │   ├── BlueprintViewer.tsx  # Interactive SVG pan/zoom viewer & exports
│   │   │   ├── ShoppingList.tsx     # Building count & logistics checklist
│   │   │   └── ProductionTable.tsx  # Granular per-machine rate breakdown
│   │   └── lib/
│   │       ├── api.ts               # Typed fetch client
│   │       └── types.ts             # TypeScript mirror of API schemas
│   ├── package.json
│   └── next.config.ts               # API rewrite proxy configuration
└── README.md
```

---

## ❓ Troubleshooting

- **PowerShell Script Execution Error (`Activate.ps1 cannot be loaded`)**:
  Run PowerShell as Administrator or execute for current user:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
  ```
- **Port Conflicts (`Port 8000 or 3000 already in use`)**:
  - Run the backend on a different port:
    ```bash
    python -m uvicorn app.main:app --port 8001 --reload
    ```
    Then update the proxy target in `frontend/next.config.ts`.
- **Frontend can't connect to backend**:
  Verify the Python backend is running at `http://localhost:8000` before querying from the frontend UI.

---

## 📄 License

Distributed under the MIT License. Contributions and feedback are welcome!
