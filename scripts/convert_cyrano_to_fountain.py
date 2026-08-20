"""One-off converter: Plays/CyranoDeBergerac.txt (classical French play transcript)
-> Plays/CyranoDeBergerac.fountain (Fountain markup, per EncorePlay.backend.fountain_parser MVP subset).

Run: python scripts/convert_cyrano_to_fountain.py
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Plays" / "CyranoDeBergerac.txt"
DEST = ROOT / "Plays" / "fountain" / "CyranoDeBergerac.fountain"

ROMAN_VALUES = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}

ACT_RE = re.compile(r"^Acte\s+([IVXLCDM]+)\.\s*$")
SCENE_RE = re.compile(r"^Sc[eè]ne\s+(?:\d+\.)?[IVXLCDM]+\.\s*$", re.IGNORECASE)
PAREN_TAIL_RE = re.compile(r"\)\s*:?\s*$")
TRAILING_COLON_AFTER_PAREN_RE = re.compile(r"\)\s*:\s*$")


def roman_to_int(roman: str) -> int:
    total = 0
    prev = 0
    for ch in reversed(roman):
        value = ROMAN_VALUES[ch]
        total += -value if value < prev else value
        prev = max(prev, value)
    return total


def looks_like_cue_name(candidate: str) -> bool:
    name = candidate.strip()
    if not name:
        return False
    return name == name.upper() and any(ch.isalpha() for ch in name)


def build_title_page(front_lines: list[str]) -> str:
    text = "\n".join(front_lines)
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]

    idx_personnages = next(i for i, b in enumerate(blocks) if b.startswith("Personnages:"))
    title, author, genre, premiere = blocks[0], blocks[1], blocks[2], blocks[3]
    dedication = " ".join(" ".join(b.split()) for b in blocks[4:idx_personnages])

    # "Personnages:" header and the name list are separate blank-line-separated blocks.
    names = [line.strip() for line in blocks[idx_personnages + 1].split("\n") if line.strip()]
    characters = ", ".join(name.title() for name in names)

    notes = " ".join(" ".join(b.split()) for b in blocks[idx_personnages + 2 :])

    fields = {
        "Title": title.title(),
        "Author": author,
        "Genre": " ".join(genre.split()),
        "Premiere": " ".join(premiere.split()),
        "Dedication": dedication,
        "Characters": characters,
        "Notes": notes,
    }
    return "\n".join(f"{key}: {value}" for key, value in fields.items())


def convert_body(body_lines: list[str]) -> str:
    out: list[str] = []
    # Each act opens with a title/setting paragraph before its first "## SCÈNE" heading.
    # The parser auto-creates a Scene 1 for that content, so real scenes would shift by
    # one; buffer act-preamble content and flush it right after the first scene heading.
    preamble: list[str] | None = None
    scene_num = 0
    expect_cue = True
    i = 0
    n = len(body_lines)

    def emit(text: str) -> None:
        (preamble if preamble is not None else out).append(text)

    while i < n:
        line = body_lines[i].strip()

        if not line:
            emit("")
            expect_cue = True
            i += 1
            continue

        act_match = ACT_RE.match(line)
        if act_match:
            out.append(f"# ACTE {roman_to_int(act_match.group(1))}")
            out.append("")
            scene_num = 0
            preamble = []
            expect_cue = True
            i += 1
            continue

        if SCENE_RE.match(line):
            scene_num += 1
            out.append(f"## SC\u00c8NE {scene_num}")
            out.append("")
            if preamble is not None:
                while preamble and not preamble[0]:
                    preamble.pop(0)
                while preamble and not preamble[-1]:
                    preamble.pop()
                out.extend(preamble)
                preamble = None
            expect_cue = True
            i += 1
            continue

        if line.startswith("("):
            joined = line
            j = i
            while not PAREN_TAIL_RE.search(joined) and j + 1 < n:
                j += 1
                joined += " " + body_lines[j].strip()
            joined = TRAILING_COLON_AFTER_PAREN_RE.sub(")", joined)
            emit(joined)
            i = j + 1
            expect_cue = False
            continue

        if expect_cue:
            if line.endswith(":") and "(" not in line:
                candidate = line[:-1].strip()
                if looks_like_cue_name(candidate):
                    emit(candidate)
                    expect_cue = False
                    i += 1
                    continue

            paren_idx = line.find("(")
            if paren_idx > 0:
                candidate = line[:paren_idx].strip()
                if looks_like_cue_name(candidate):
                    joined = line[paren_idx:]
                    j = i
                    while not PAREN_TAIL_RE.search(joined) and j + 1 < n:
                        j += 1
                        joined += " " + body_lines[j].strip()
                    joined = TRAILING_COLON_AFTER_PAREN_RE.sub(")", joined)
                    emit(candidate)
                    emit(joined)
                    expect_cue = False
                    i = j + 1
                    continue

        emit(line)
        expect_cue = False
        i += 1

    return "\n".join(out)


def main() -> None:
    raw = SRC.read_text(encoding="utf-8").lstrip("\ufeff")
    lines = raw.split("\n")
    first_act_idx = next(i for i, l in enumerate(lines) if ACT_RE.match(l.strip()))

    title_page = build_title_page(lines[:first_act_idx])
    body = convert_body(lines[first_act_idx:])
    fountain_text = f"{title_page}\n\n{body}\n"

    DEST.write_text(fountain_text, encoding="utf-8", newline="\n")
    print(f"Wrote {DEST} ({len(fountain_text.splitlines())} lines)")


if __name__ == "__main__":
    main()
