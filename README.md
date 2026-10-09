# 🏭 Satisfactory Factory Management System

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://satisfactoryfactorymanagementsystem.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000.svg?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React Flow](https://img.shields.io/badge/XYFlow-React--Flow-FF0072.svg?style=for-the-badge)](https://reactflow.dev/)
[![Satisfactory 1.0](https://img.shields.io/badge/Satisfactory-v1.0%20Ready-F39C12.svg?style=for-the-badge)](https://satisfactory.gamepedia.com/)

**Interactive Blueprint Designer & Linear Production Optimizer for Satisfactory 1.0**

👉 **Live Application**: [satisfactoryfactorymanagementsystem.vercel.app](https://satisfactoryfactorymanagementsystem.vercel.app/)

</div>

---

## 📖 Overview

The **Satisfactory Factory Management System** is a full-stack mathematical modeling and visual blueprint design engine for Coffee Stain Studios' **Satisfactory (v1.0)**. 

Instead of relying on guesswork, spreadsheets, or round-number approximations, this application formulates factory planning as an exact **Linear Programming (LP)** optimization problem solved by `scipy.optimize.linprog` (HiGHS solver). It determines the mathematically optimal recipe combination, precise machine counts, exact clock speeds down to fractional percentages, physical conveyor manifolds, and belt tier requirements—then lays out the entire production floor on an interactive, zoomable node-graph blueprint canvas.

---

## ⚡ Key Highlights & Capabilities

### 🧠 Exact Linear Production Solver
- **Resource-Constrained Mode (Max Output)**: Specify your mining output (e.g. 720 Iron Ore/min from an overclocked pure node on Mk.5 belts) and target product, and the solver calculates the theoretical maximum output.
- **Target-Driven Mode**: Specify desired production quotas (e.g. exactly 10 Modular Frames/min), and the solver determines the minimal raw resource intake and intermediate processing tree.
- **Conservation of Mass Guarantees**: Solves a system of linear equality constraints ensuring every intermediate product has zero surplus waste and zero starvation bottlenecks.
- **Precision Machine Clocking**: Splits machine allocations into $N$ full-speed (100%) machines and 1 underclocked machine running at the exact residual rate, preventing surging and power spikes.

### 📦 Physical Logistics & Manifold Engine
- **Chained Manifold Layouts**: Automatically decomposes high-rate multi-machine arrays into serial splitters and mergers, mirroring standard in-game construction.
- **Conveyor Belt & Pipeline Constraints**:
  - Supports all Conveyor Belt tiers: Mk.1 (60), Mk.2 (120), Mk.3 (270), Mk.4 (480), Mk.5 (780), and Mk.6 (1200 items/min).
  - Supports Pipelines: Mk.1 (300 m³/min) and Mk.2 (600 m³/min).
- **Overclocking & Power Shards**: Allows user-toggled machine overclocking up to 250%, automatically calculating required **Power Shards** and exponential power scaling.
- **Remainder Handling Strategies**: Configure how surplus/residual outputs are handled—`merge`, `underclock`, or `dedicated` sub-lines.

### 🎨 Interactive Node-Based Blueprint Canvas
- **Planar Bus Routing**: Custom orthogonal conveyor routing engine with dedicated vertical transit channels and horizontal branch stubs, preventing crisscrossing belts and overlapping labels.
- **Custom React Flow Nodes**:
  - `MachineNode`: Displays recipe icon, building model, machine count, active clock speed percentage, power draw, and input/output handles.
  - `SplitterNode` & `MergerNode`: Manifold distribution hubs with centered port alignment.
  - `ResourceNode` & `OutputNode`: Raw extraction roots and final factory sink endpoints.
- **Inspection & Navigation**: Smooth pan, zoom, mini-map, canvas fit-to-view, and high-resolution export.

### 🔄 Multi-Variant Recipe & Tier Comparison
- **Alternative Recipe Optimization**: Unlock and toggle any Satisfactory 1.0 Alternate Recipe (e.g. Cast Screw, Steeled Frame, Iron Wire, Encased Industrial Pipe) to drastically simplify supply lines.
- **Side-by-Side Blueprint Diffing**: Compare different recipe combinations side-by-side with clear indicators for minimum machine footprint and lowest power consumption.
- **Belt Tier Sensitivity Analysis**: Quickly preview how upgrading or restricting your maximum available conveyor belt tier alters splitter counts and line throughput.

### 🩺 Real-Time Build Diagnostics & Validation
- Instant automated inspection reporting:
  - Belt throughput saturation and bottlenecks.
  - Pipeline flow limits.
  - Click-to-highlight feature identifying offender nodes and connection lines directly on the canvas.

### 📋 Instant Bill of Materials & URL Sharing
- **Shopping List**: Complete breakdown of total buildings required, power poles, conveyor splitters/mergers, power shards, and MW consumption before placing a single foundation in-game.
- **1-Click Shareable URLs**: State is serialized into URL hash parameters—share exact factory designs with teammates with one copy-paste.
- **Built-In Factory Presets**: Pre-configured templates for common milestones (Starter Iron, Modular Frames, Steel Lines, Heavy Modular Frames).

---

## 📐 Architecture & Technology Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│               Frontend: Next.js 16 (App Router) & React 19             │
│                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │   Control Panel         │  │   Interactive Blueprint Canvas      │  │
│  │   • Resource Inputs     │  │   • React Flow (@xyflow/react)      │  │
│  │   • Target Quotas       │  │   • Orthogonal Planar Bus Routing   │  │
│  │   • Alternate Recipes   │  │   • Machine, Splitter, Merger Nodes │  │
│  │   • Belt Tier Settings  │  │   • Animated Belt-Speed Edges       │  │
│  └─────────────────────────┘  └─────────────────────────────────────┘  │
│  ┌─────────────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Shopping List & Power   │  │ Recipe Compare   │  │ Diagnostics   │  │
│  └─────────────────────────┘  └──────────────────┘  └───────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP Proxy (:3000/api/* -> :8000)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Backend: Python 3.11+ & FastAPI                     │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ProductionSolver (scipy.optimize.linprog HiGHS)                  │  │
│  │ • Objective: Maximize target items / Minimize power consumption  │  │
│  │ • Conservation of mass equality constraints                      │  │
│  │ • Raw mining extraction inequality bounds                        │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │ LogisticsSolver (Manifold Routing & Belt Assignment)              │  │
│  │ • Chained Splitter & Merger topology                             │  │
│  │ • Belt tier sizing (Mk.1 – Mk.6) & Pipe sizing (Mk.1 – Mk.2)     │  │
│  │ • Power shard allocation for overclocked edge units              │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │ Satisfactory 1.0 Game Data Layer                                 │  │
│  │ • Items (Solids, Liquids, Gases)                                 │  │
│  │ • Recipes (Standard & Alternate)                                 │  │
│  │ • Buildings & Power Scaling Curves                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🧮 Mathematical Solver Mechanics

### 1. Linear Programming Formulation
Production planning is structured as a continuous linear program:

$$\max \quad \mathbf{c}^T \mathbf{x} \quad \text{subject to} \quad \mathbf{A}_{eq} \mathbf{x} = \mathbf{b}_{eq}, \quad \mathbf{A}_{ub} \mathbf{x} \le \mathbf{b}_{ub}, \quad \mathbf{x} \ge \mathbf{0}$$

- **Decision Variables ($\mathbf{x}$)**: The execution rate $x_r$ (cycles per minute) for each game recipe $r$.
- **Intermediate Mass Balance ($\mathbf{A}_{eq} \mathbf{x} = \mathbf{0}$)**: For every non-resource, non-target item $i$, net generation must balance net consumption:
  $$\sum_{r} P_{i, r} x_r - \sum_{r} C_{i, r} x_r = 0$$
- **Resource Constraints ($\mathbf{A}_{ub} \mathbf{x} \le \mathbf{R}$)**: Raw resource extraction cannot exceed the input limits:
  $$\sum_{r} C_{raw, r} x_r \le R_{available}$$

### 2. Residual Machine Underclocking
To avoid the power waste and line stuttering caused by fractional machines shutting down, the system computes:
- $\text{Total Machines} = \lceil M \rceil$
- $N_{normal} = \lfloor M \rfloor$ machines operating at $100\%$ clock speed
- $1$ residual machine operating at $c_{residual} = (M - \lfloor M \rfloor) \times 100\%$

### 3. Non-Linear Power Scaling (Satisfactory 1.0)
For overclocked machines running at clock speed percentage $c \in [100, 250]$:
$$P(c) = P_{base} \times \left(\frac{c}{100}\right)^{1.321928}$$

---

## 🚚 Logistics & Belt Specifications

| Conveyor Tier | Max Speed (items/min) | Primary Material |
| :--- | :--- | :--- |
| **Conveyor Belt Mk.1** | `60` | Iron Plates |
| **Conveyor Belt Mk.2** | `120` | Reinforced Iron Plates |
| **Conveyor Belt Mk.3** | `270` | Steel Beams |
| **Conveyor Belt Mk.4** | `480` | Encased Industrial Beams |
| **Conveyor Belt Mk.5** | `780` | Alclad Aluminum Sheets |
| **Conveyor Belt Mk.6** | `1200` | Fused Modular Frames |

| Pipeline Tier | Max Flow Rate (m³/min) | Primary Material |
| :--- | :--- | :--- |
| **Pipeline Mk.1** | `300` | Copper Sheets |
| **Pipeline Mk.2** | `600` | Aluminum Casings |

---

## 💻 Prerequisites

Ensure you have the following installed:

1. **Git**: [git-scm.com](https://git-scm.com/downloads)
2. **Python 3.11+**: [python.org](https://www.python.org/downloads/) *(Verify "Add Python to PATH" is enabled on Windows)*
3. **Node.js 18+ & npm**: [nodejs.org](https://nodejs.org/)

---

## 🚀 Quick Start / Local Setup

Clone the repository:

```bash
git clone https://github.com/Brelios/Satisfactory_Factory_Management_System.git
cd Satisfactory_Factory_Management_System
```

### 1. Start the Backend API

#### Windows (PowerShell)
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -e ".[dev]"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### macOS / Linux
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **API Endpoint**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`

---

### 2. Start the Frontend Application

In a separate terminal window:

```bash
cd frontend
npm install
npm run dev
```

- **Web Dashboard**: `http://localhost:3000`

*(API requests matching `/api/*` are automatically proxied to port 8000 by Next.js).*

---

## 🛠️ API Reference

### Key Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/solve` | Solves production flow, builds logistics manifolds, and outputs graph layout |
| `POST` | `/api/solve/compare` | Evaluates alternative recipe combinations and returns comparative variants |
| `GET` | `/api/items` | Retrieves all Satisfactory items (solids, fluids, gases) |
| `GET` | `/api/recipes` | Retrieves available recipes with optional item and alternate filters |
| `GET` | `/api/buildings` | Lists production machines and base power ratings |
| `GET` | `/api/resources` | Lists extractable raw resources |

### Example: Solve Production Request

```bash
curl -X POST http://localhost:8000/api/solve \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "resource_constrained",
    "resources": {
      "iron_ore": 720
    },
    "target_items": ["modular_frame"],
    "optimization": "maximize_output",
    "max_belt_tier": 3,
    "enforce_belt_limit": true
  }'
```

---

## 🧪 Testing

### Backend Unit & Integration Tests
```bash
cd backend
pytest
```
Includes tests for:
- Mass balance validation
- Resource constraint linear programming
- Chained manifold decomposition
- Pipeline fluid and conveyor speed boundaries

### Frontend Typechecking & Production Build
```bash
cd frontend
npm run build
```

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
│   │   │   ├── logistics_solver.py  # Chained manifold, splitter/merger & belt logistics
│   │   │   └── rate_calculator.py   # Machine rounding, clocking & belt tier selection
│   │   └── layout/
│   │       └── svg_generator.py     # SVG schematic generation engine
│   ├── pyproject.toml               # Python package configuration
│   ├── test_api_unit.py             # Backend unit test suite
│   └── test_logistics_solver.py     # Manifold & logistics validation tests
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Interactive dashboard (Inputs, React Flow Canvas, Panels)
│   │   │   ├── layout.tsx           # Dark theme layout shell
│   │   │   └── globals.css          # Tailwind CSS & blueprint styling
│   │   ├── components/
│   │   │   ├── BlueprintCanvas.tsx  # React Flow canvas with custom nodes & bus routing
│   │   │   ├── ConveyorBridgeEdge.tsx # Conveyor routing & belt-tier edge renderer
│   │   │   ├── MachineNode.tsx      # Building node with clock speed & I/O ports
│   │   │   ├── SplitterNode.tsx     # Dynamic manifold splitter node
│   │   │   ├── MergerNode.tsx       # Dynamic manifold merger node
│   │   │   ├── ResourceNode.tsx     # Ore & fluid extraction input node
│   │   │   ├── OutputNode.tsx       # End-product sink output node
│   │   │   ├── AltRecipePanel.tsx   # Alternate recipe selection drawer
│   │   │   ├── TierComparePanel.tsx # Belt tier throughput impact comparison
│   │   │   ├── ComparePanel.tsx     # Side-by-side recipe solver diffing
│   │   │   ├── ValidationPanel.tsx  # Real-time build diagnostic warnings
│   │   │   ├── ShoppingList.tsx     # Building count & logistics checklist
│   │   │   └── ProductionTable.tsx  # Granular per-machine rate breakdown
│   │   └── lib/
│   │       ├── api.ts               # Typed fetch client
│   │       ├── presets.ts           # Factory starter templates
│   │       ├── share.ts             # State serialization & URL hash generation
│   │       └── types.ts             # TypeScript mirror of API schemas
│   ├── package.json
│   └── next.config.ts               # API rewrite proxy configuration
├── LICENSE                          # MIT License
└── README.md
```

---

## ❓ Troubleshooting

- **PowerShell Execution Policy**:
  If `Activate.ps1 cannot be loaded` appears:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
  ```
- **Port In Use (8000 or 3000)**:
  Run backend on a custom port:
  ```powershell
  python -m uvicorn app.main:app --port 8001 --reload
  ```
  Then adjust the proxy destination in `frontend/next.config.ts`.
- **Frontend / Backend Communication**:
  Ensure the backend is running and listening on port 8000 before clicking **Solve Blueprint**.

---

## 📄 License & Attribution

- Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
- Game assets, recipe values, and Satisfactory imagery are intellectual property of **Coffee Stain Studios**. This project is an unofficial community tool.
