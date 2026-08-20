"""Fountain (.fountain) markup parser producing the internal Play JSON model.

Parsing itself is delegated to the ``screenplain`` library (MIT-licensed,
https://pypi.org/project/screenplain/), which implements the full Fountain spec
(title page incl. multi-line values, acts/scenes via `#`/`##` sections, standard and
forced scene headings, character cues with extensions like (V.O.)/(CONT'D), dual
dialogue, parentheticals, transitions, centered text, page breaks and boneyard/notes
stripping). This module only adapts screenplain's flat `Screenplay` paragraph list
into EncorePlay's nested Play/Act/Scene/Character/Element model (PRD-Theatre.md §4.1).
"""

from __future__ import annotations

import io
import re

from screenplain.parsers.fountain import parse as _screenplain_parse
from screenplain.parsers.fountain import (
    Action as SPAction,
    Dialog as SPDialog,
    DualDialog as SPDualDialog,
    PageBreak as SPPageBreak,
    Section as SPSection,
    Slug as SPSlug,
    Transition as SPTransition,
)
from screenplain.richstring import parse_emphasis

from .models import (
    Act,
    Character,
    DialogueElement,
    Play,
    Scene,
    StageDirectionElement,
)

_CHARACTER_EXTENSION_RE = re.compile(r"(\s*\([^)]*\))+\s*$")
_PARENTHETICAL_RE = re.compile(r"^\((.*)\)$")

# Simple heuristic classifying characters by their share of the play's total dialogue
# lines: main roles carry a large chunk of the dialogue, minor/"figurant" roles barely
# speak at all. Thresholds are approximate and meant as a starting point, not a
# definitive dramaturgical analysis.
_MAIN_CHARACTER_SHARE = 0.10
_SUPPORTING_CHARACTER_SHARE = 0.02


def _text(value: object) -> str:
    """Render a screenplain RichString (or plain str) as plain text."""
    return str(value).strip()


def _first(values: list[str] | None) -> str | None:
    """Join title-page value lines into one string, stripping markdown emphasis."""
    if not values:
        return None
    joined = " ".join(_text(parse_emphasis(v)) for v in values if v.strip())
    return joined or None


def _clean_character_name(raw: str) -> str:
    """Strip trailing extensions like (V.O.), (O.S.), (CONT'D) to group cues by actor."""
    return _CHARACTER_EXTENSION_RE.sub("", raw).strip()


def _classify_role(share: float) -> str:
    if share >= _MAIN_CHARACTER_SHARE:
        return "main"
    if share >= _SUPPORTING_CHARACTER_SHARE:
        return "supporting"
    return "minor"


class _PlayBuilder:
    """Accumulates screenplain paragraphs into the nested Act/Scene/Element structure."""

    def __init__(self) -> None:
        self.acts: list[Act] = []
        self.characters: dict[int, Character] = {}
        self._character_ids_by_name: dict[str, int] = {}

    def _current_act(self) -> Act:
        if not self.acts:
            self.acts.append(Act(act_number=1))
        return self.acts[-1]

    def _current_scene(self) -> Scene:
        act = self._current_act()
        if not act.scenes:
            act.scenes.append(Scene(scene_number=1))
        return act.scenes[-1]

    def start_act(self, title: str | None) -> None:
        self.acts.append(Act(act_number=len(self.acts) + 1, title=title))

    def start_scene(self, title: str | None) -> None:
        act = self._current_act()
        act.scenes.append(Scene(scene_number=len(act.scenes) + 1, title=title))

    def register_character(self, raw_name: str) -> int:
        name = _clean_character_name(raw_name)
        if name in self._character_ids_by_name:
            return self._character_ids_by_name[name]
        char_id = len(self.characters) + 1
        self.characters[char_id] = Character(id=char_id, name=name)
        self._character_ids_by_name[name] = char_id
        return char_id

    def add_action(self, content: str) -> None:
        if content:
            self._current_scene().elements.append(StageDirectionElement(content=content))

    def add_dialogue(self, dialog: SPDialog) -> None:
        char_id = self.register_character(_text(dialog.character))
        element = DialogueElement(character_id=char_id)
        for index, (is_parenthetical, block) in enumerate(dialog.blocks):
            text = _text(block)
            if not text:
                continue
            if index == 0 and is_parenthetical and element.parenthetical is None:
                match = _PARENTHETICAL_RE.match(text)
                element.parenthetical = match.group(1) if match else text
                continue
            element.lines.append(text)
        self.characters[char_id].line_count += len(element.lines)
        self._current_scene().elements.append(element)

    def build(self, title: str | None, author: str | None) -> Play:
        total_lines = sum(character.line_count for character in self.characters.values())
        for character in self.characters.values():
            share = character.line_count / total_lines if total_lines else 0.0
            character.role = _classify_role(share)
        return Play(
            title=title,
            author=author,
            characters=list(self.characters.values()),
            acts=self.acts or [Act(act_number=1)],
        )


def parse_fountain(text: str) -> Play:
    """Parse Fountain markup text into the internal Play model."""
    screenplay = _screenplain_parse(io.StringIO(text.lstrip("\ufeff")))

    builder = _PlayBuilder()
    for paragraph in screenplay.paragraphs:
        if isinstance(paragraph, SPSection):
            title = _text(paragraph.text)
            if paragraph.level <= 1:
                builder.start_act(title)
            else:
                builder.start_scene(title)
        elif isinstance(paragraph, SPSlug):
            builder.start_scene(_text(paragraph.line))
        elif isinstance(paragraph, SPDialog):
            builder.add_dialogue(paragraph)
        elif isinstance(paragraph, SPDualDialog):
            builder.add_dialogue(paragraph.left)
            builder.add_dialogue(paragraph.right)
        elif isinstance(paragraph, SPTransition):
            builder.add_action(_text(paragraph.line))
        elif isinstance(paragraph, SPAction):
            content = " ".join(_text(line) for line in paragraph.lines if _text(line))
            builder.add_action(content)
        elif isinstance(paragraph, SPPageBreak):
            continue

    title_page = screenplay.title_page
    return builder.build(
        title=_first(title_page.get("Title")),
        author=_first(title_page.get("Author")) or _first(title_page.get("Credit")),
    )
