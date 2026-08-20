"""FastAPI application exposing script import endpoints over the parsing/model layer."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .fountain_parser import parse_fountain
from .models import Play

app = FastAPI(title="EncorePlay API", version="0.1.0")


class FountainImportRequest(BaseModel):
    text: str


def _parse_or_400(text: str) -> Play:
    try:
        return parse_fountain(text)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse Fountain script: {exc}") from exc


@app.post("/api/plays/import/fountain", response_model=Play)
def import_fountain_text(payload: FountainImportRequest) -> Play:
    return _parse_or_400(payload.text)


@app.post("/api/plays/import/fountain/file", response_model=Play)
async def import_fountain_file(file: UploadFile = File(...)) -> Play:
    content = (await file.read()).decode("utf-8")
    return _parse_or_400(content)


# Mounted last so it acts as a catch-all for the static frontend without shadowing the API routes above.
_FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")

