from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router, get_game_data

app = FastAPI(
    title="Satisfactory Factory Blueprint Builder",
    description="API for calculating production steps and generating blueprints in Satisfactory.",
    version="1.0.0"
)

# Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.on_event("startup")
async def startup_event():
    # Pre-load game data on startup
    get_game_data()

@app.get("/")
def read_root():
    return {
        "title": app.title,
        "description": app.description,
        "version": app.version,
        "docs_url": "/docs"
    }
