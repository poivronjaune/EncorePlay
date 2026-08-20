# EncorePlay

Backend for a theatre rehearsal practice tool: imports **Fountain** screenplay/play
files and converts them into a structured JSON `Play` document (title, acts, scenes,
characters, dialogue and stage directions) via a small FastAPI service.

## Summary — what is actually implemented

- A Fountain-to-JSON parser ([EncorePlay/backend/fountain_parser.py](EncorePlay/backend/fountain_parser.py))
  that delegates the raw parsing to the `screenplain` library and adapts its output into
  EncorePlay's own data model.
- A Pydantic data model ([EncorePlay/backend/models.py](EncorePlay/backend/models.py)):
  `Play` → `Act` → `Scene` → `Element` (`StageDirectionElement` or `DialogueElement`),
  plus a top-level `characters` list.
- A minimal FastAPI app ([EncorePlay/backend/api.py](EncorePlay/backend/api.py)) with two
  endpoints to import a Fountain script (raw text or uploaded file) and get back the
  parsed `Play` as JSON.
- A one-off conversion script ([scripts/convert_cyrano_to_fountain.py](scripts/convert_cyrano_to_fountain.py))
  that turns the classical-French-play transcript in `Plays/CyranoDeBergerac.txt` into
  valid Fountain markup.
- A diagnostic script ([scripts/check_parse.py](scripts/check_parse.py)) that parses any
  `.fountain` file and prints act/scene/character stats, useful for sanity-checking new
  or edited scripts.
- A pytest suite ([tests/test_fountain_parser.py](tests/test_fountain_parser.py)) covering
  title-page parsing, act/scene headings, character cues, parentheticals and a golden
  fixture ([tests/fixtures/cyrano.fountain](tests/fixtures/cyrano.fountain)).

Not implemented yet (see [References/PRD-Theatre.md](References/PRD-Theatre.md) for the
full product vision): the frontend ([EncorePlay/frontend/](EncorePlay/frontend/) is an
empty placeholder), TTS/voice assignment, rehearsal/practice modes, JSON/plain-text
import.

## Running it

```powershell
# Activate the venv, then install in editable mode
pip install -e ".[dev]"

# Run the API server (http://127.0.0.1:8000)
python run.py

# Run the test suite
pytest -q
```

## API

All backend endpoints are namespaced under `/api` (the frontend is served separately, at
`/`). Base URL: `http://127.0.0.1:8000` (title `EncorePlay API`, no auth). Both endpoints
return the same `Play` JSON shape on success, or `400` with a `detail` message if the
Fountain text fails to parse.

### `POST /api/plays/import/fountain`

Import a Fountain script from a raw text body.

**Request body** (`application/json`):
```json
{ "text": "Title: My Play\nAuthor: Jane Doe\n\nCYRANO\nUn poète est un oiseau." }
```

**Response** (`200`, `application/json`): a `Play` object — see [JSON output shape](#json-output-shape-play-model) below.

**Errors**: `400` if `parse_fountain` raises (the exception message is included in
`detail`).

### `POST /api/plays/import/fountain/file`

Same as above, but the Fountain text is uploaded as a file (`multipart/form-data`,
field name `file`). The file is decoded as UTF-8 before parsing.

```powershell
curl -X POST http://127.0.0.1:8000/api/plays/import/fountain/file -F "file=@Plays/fountain/BigFish.fountain"
```

### JSON output shape (`Play` model)

```jsonc
{
  "title": "string | null",
  "author": "string | null",
  "version": "1.0",
  "characters": [
    { "id": 1, "name": "EDWARD", "lang": "fr-FR", "line_count": 321, "role": "main" }
  ],
  "acts": [
    {
      "act_number": 1,
      "title": "string | null",
      "scenes": [
        {
          "scene_number": 1,
          "title": "string | null",
          "elements": [
            { "type": "stage_direction", "content": "..." },
            { "type": "dialogue", "character_id": 1, "parenthetical": "string | null", "lines": ["..."] }
          ]
        }
      ]
    }
  ]
}
```

## How the Fountain → JSON conversion works

`parse_fountain()` in [fountain_parser.py](EncorePlay/backend/fountain_parser.py) hands
the raw text to `screenplain.parsers.fountain.parse()`, then walks the resulting flat
list of typed paragraphs (`Section`, `Slug`, `Dialog`, `DualDialog`, `Action`,
`Transition`, `PageBreak`) to build the nested `Play` model. The rules applied:

- **Title / author**: read from the Fountain title page (`Title:` / `Author:` /
  `Credit:` keys). Markdown emphasis (`**bold**`, `_italic_`) is stripped from these
  values. `Author` is preferred over `Credit` if both are present.
- **Acts**: a `#` section heading (level 1) starts a new `Act`; its text becomes the
  act's `title`.
- **Scenes**: a `##` section heading (level 2+), or **any** scene heading/slugline
  (`INT.`/`EXT.`/`INT./EXT.` or a forced `.HEADING`), starts a new `Scene`; its text
  becomes the scene's `title`. If no act/scene heading is present at all, everything is
  placed into an implicit "Act 1 / Scene 1".
- **Dialogue**: each character cue + its following lines become one `DialogueElement`.
  - The character name is registered (and reused across the whole play) after
    **stripping trailing extensions** like `(V.O.)`, `(O.S.)`, `(CONT'D)` — so
    `EDWARD`, `EDWARD (V.O.)` and `EDWARD (V.O.)(CONT'D)` all map to a single `EDWARD`
    character instead of three separate ones.
  - The first line right after the cue, if wrapped in parentheses, becomes the
    element's `parenthetical` (parens stripped); every other line (including later
    inline parentheticals) is appended to `lines` as plain text.
  - `DualDialog` (simultaneous dialogue, Fountain's `^` syntax) is flattened into two
    separate sequential `DialogueElement`s — there's no dual-dialogue concept in this
    model.
- **Action / stage directions**: any `Action` paragraph becomes a `StageDirectionElement`,
  with its lines joined by spaces into a single `content` string. `Transition` lines
  (e.g. `CUT TO:`) are also mapped to `StageDirectionElement`. `PageBreak` paragraphs
  are dropped (no equivalent in the model).
- **Character `role` classification** (`main` / `supporting` / `minor`): computed after
  parsing, purely from each character's share of the play's **total dialogue lines**
  (`line_count` summed across every element they speak, divided by the play's grand
  total):
  - `share >= 10%` → `"main"`
  - `2% <= share < 10%` → `"supporting"`
  - `share < 2%` → `"minor"` (walk-ons, one-liners, crowd voices)

  This is a simple volume-based heuristic, not a dramaturgical analysis — a plot-critical
  but quiet character would still be classified as `"minor"`.

## Python libraries used

- **[FastAPI](https://fastapi.tiangolo.com/)** — the web framework exposing the import
  endpoints.
- **[Pydantic](https://docs.pydantic.dev/)** — the `Play`/`Act`/`Scene`/`Character`/
  `Element` data model and request/response validation.
- **[Uvicorn](https://www.uvicorn.org/)** (`standard` extra) — the ASGI server used by
  [run.py](run.py) to serve the FastAPI app.
- **[python-multipart](https://github.com/Kludex/python-multipart)** — required by
  FastAPI/Starlette to parse the `multipart/form-data` file upload on
  `/api/plays/import/fountain/file`.
- **[screenplain](https://pypi.org/project/screenplain/)** — does the actual Fountain
  parsing (title page, sections, sluglines, dialogue, dual dialogue, transitions,
  centered text, page breaks, boneyard/notes stripping). EncorePlay only adapts its
  output into its own model; screenplain pulls in `reportlab` as a transitive
  dependency (used for its own PDF export, unused here).
- **pytest** / **httpx** (dev-only) — test runner and HTTP client used by the test suite.

## Links to investigate
[Afterwritten](https://afterwriting.com/) - Fountain Script Formatter 
