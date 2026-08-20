"""Pydantic models for the internal Play/Act/Scene/Element JSON schema (PRD-Theatre.md §4.1)."""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class Character(BaseModel):
    id: int
    name: str
    lang: str = "fr-FR"
    line_count: int = 0
    role: Literal["main", "supporting", "minor"] = "minor"


class StageDirectionElement(BaseModel):
    type: Literal["stage_direction"] = "stage_direction"
    content: str


class DialogueElement(BaseModel):
    type: Literal["dialogue"] = "dialogue"
    character_id: int
    parenthetical: str | None = None
    lines: list[str] = Field(default_factory=list)


Element = Annotated[Union[StageDirectionElement, DialogueElement], Field(discriminator="type")]


class Scene(BaseModel):
    scene_number: int
    title: str | None = None
    elements: list[Element] = Field(default_factory=list)


class Act(BaseModel):
    act_number: int
    title: str | None = None
    scenes: list[Scene] = Field(default_factory=list)


class Play(BaseModel):
    title: str | None = None
    author: str | None = None
    version: str = "1.0"
    characters: list[Character] = Field(default_factory=list)
    acts: list[Act] = Field(default_factory=list)
