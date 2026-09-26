# 🏭 Satisfactory Factory Management System

A production solver and visual blueprint generator for Satisfactory. Input your available resources, and the system calculates the optimal factory layout — how many machines, what recipes, belt tiers, and power — then renders it as a schematic blueprint.

## Features

- **Resource-Constrained Solver** — "I have 720 iron ore/min, maximize modular frames"
- **Target-Driven Solver** — "I want 10 modular frames/min, what do I need?"
- **Linear Programming Optimizer** — scipy LP solver for mathematically optimal production
- **SVG Blueprint Generator** — Dark engineering schematic with labeled nodes, belt connections, and rates
- **Alt Recipe Support** — Toggle unlocked alternative recipes
- **Shopping List** — Exact building counts, belt tiers, power budget
- **REST API** — FastAPI backend with full Swagger docs at `/docs`
- **Web Frontend** — React/Next.js dark-themed UI

## Architecture

```
┌─────────────────────────────────────────────┐
│  Frontend (Next.js + React + Tailwind)      │
│  Input Panel │ SVG Blueprint │ Shopping List │
├──────────────┴──────────────┴───────────────┤
│  Backend (Python FastAPI)                    │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐ │
│  │ LP      │  │ Recipe   │  │ SVG        │ │
│  │ Solver  │  │ Graph    │  │ Generator  │ │
│  │ (scipy) │  │(networkx)│  │            │ │
│  └─────────┘  └──────────┘  └────────────┘ │
│  Game Data: 41 items, 32 recipes, 8 machines│
└─────────────────────────────────────────────┘
```

## Quick Start

### Backend
```bash
cd backend
pip install -e ".[dev]"
python -m uvicorn app.main:app --reload
# API at http://localhost:8000  |  Docs at http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# UI at http://localhost:3000
```

### Example API Call
```bash
curl -X POST http://localhost:8000/api/solve \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "resource_constrained",
    "resources": {"iron_ore": 720},
    "target_items": ["modular_frame"],
    "optimization": "maximize_output"
  }'
```

**Result:** 30 Modular Frames/min from 720 Iron Ore using 97 machines at 647 MW.

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entry point
│   │   ├── api/
│   │   │   ├── schemas.py           # Pydantic request/response models
│   │   │   └── routes.py            # REST API endpoints
│   │   ├── data/
│   │   │   ├── models.py            # Core data types
│   │   │   ├── loader.py            # JSON data parser
│   │   │   └── game_data/data.json  # Satisfactory 1.0 recipe data
│   │   ├── solver/
│   │   │   ├── recipe_graph.py      # NetworkX DAG builder
│   │   │   ├── linear_solver.py     # scipy LP optimizer
│   │   │   └── rate_calculator.py   # Machine counts, power, belt tiers
│   │   └── layout/
│   │       └── svg_generator.py     # SVG blueprint renderer
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── app/page.tsx             # Main UI page
│   │   ├── components/              # React components
│   │   └── lib/                     # API client + types
│   └── package.json
└── README.md
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Solver** | Python, scipy (linprog), NetworkX |
| **API** | FastAPI, Pydantic v2, Uvicorn |
| **Frontend** | Next.js, React, TypeScript, Tailwind CSS |
| **Blueprint** | SVG (pure string generation) |
| **Data** | Satisfactory 1.0 Docs.json (curated subset) |

## License

MIT
