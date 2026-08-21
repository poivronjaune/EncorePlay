"""FastAPI application exposing script import endpoints over the parsing/model layer."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .. import config
from .fountain_parser import parse_fountain
from .models import Play

app = FastAPI(title="EncorePlay API", version="0.1.0")

_PLAYS_DIR = (Path(__file__).resolve().parent.parent.parent / "Plays" / "fountain").resolve()
_PLAYS_DIR.mkdir(parents=True, exist_ok=True)
_ALLOWED_EXTENSIONS = {".fountain", ".txt"}


class FountainImportRequest(BaseModel):
    text: str


class PlayFileInfo(BaseModel):
    name: str
    size_bytes: int


def _parse_or_400(text: str) -> Play:
    try:
        return parse_fountain(text)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse Fountain script: {exc}") from exc


def _safe_filename(filename: str) -> str:
    """Strip any directory components and enforce an allowed extension, so a
    crafted filename (e.g. containing `../`) can never escape the Plays/fountain
    directory below.
    """
    name = Path(filename or "").name
    if not name or Path(name).suffix.lower() not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .fountain or .txt files are allowed.")
    return name


def _resolve_play_path(filename: str) -> Path:
    path = (_PLAYS_DIR / _safe_filename(filename)).resolve()
    if not path.is_relative_to(_PLAYS_DIR):
        raise HTTPException(status_code=400, detail="Invalid file name.")
    return path


def _decode_upload_or_400(raw: bytes) -> str:
    if len(raw) > config.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {config.MAX_UPLOAD_SIZE_BYTES} byte limit.",
        )
    if b"\x00" in raw:
        # NUL bytes never appear in real text; this is a cheap way to reject a binary
        # file that was merely renamed to look like a .fountain/.txt script.
        raise HTTPException(status_code=400, detail="File does not appear to be a plain text Fountain script.")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"File is not valid UTF-8 text: {exc}") from exc


@app.get("/api/config")
def get_config() -> dict[str, bool]:
    return {"file_upload_allowed": config.FILE_UPLOAD_ALLOWED}


@app.post("/api/plays/import/fountain", response_model=Play)
def import_fountain_text(payload: FountainImportRequest) -> Play:
    return _parse_or_400(payload.text)


@app.post("/api/plays/import/fountain/file", response_model=Play)
async def import_fountain_file(file: UploadFile = File(...)) -> Play:
    if not config.FILE_UPLOAD_ALLOWED:
        raise HTTPException(status_code=403, detail="File upload is disabled by configuration.")

    destination = _resolve_play_path(file.filename)
    if destination.exists():
        raise HTTPException(status_code=409, detail=f"A file named '{destination.name}' already exists.")

    text = _decode_upload_or_400(await file.read())
    play = _parse_or_400(text)  # validate before writing anything to disk
    destination.write_text(text, encoding="utf-8")
    return play


@app.get("/api/plays/list", response_model=list[PlayFileInfo])
def list_plays() -> list[PlayFileInfo]:
    files = sorted(
        (p for p in _PLAYS_DIR.iterdir() if p.is_file() and p.suffix.lower() in _ALLOWED_EXTENSIONS),
        key=lambda p: p.name.lower(),
    )
    return [PlayFileInfo(name=p.name, size_bytes=p.stat().st_size) for p in files]


@app.get("/api/plays/open", response_model=Play)
def open_play(name: str) -> Play:
    path = _resolve_play_path(name)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found.")
    return _parse_or_400(path.read_text(encoding="utf-8"))


# Mounted last so it acts as a catch-all for the static frontend without shadowing the API routes above.
_FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")

