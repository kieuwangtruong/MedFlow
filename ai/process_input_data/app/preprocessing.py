from __future__ import annotations

import re
import unicodedata


WHITESPACE_PATTERN = re.compile(r"\s+")
PUNCTUATION_PATTERN = re.compile(r"[^0-9a-zA-ZÀ-ỹđĐ\s]")


def normalize_text(text: str) -> str:
    """Normalize Vietnamese input while preserving diacritics for word TF-IDF."""
    normalized = unicodedata.normalize("NFC", text).lower().strip()
    normalized = PUNCTUATION_PATTERN.sub(" ", normalized)
    return WHITESPACE_PATTERN.sub(" ", normalized).strip()


def remove_diacritics(text: str) -> str:
    normalized = unicodedata.normalize("NFD", normalize_text(text))
    without_marks = "".join(
        character
        for character in normalized
        if unicodedata.category(character) != "Mn"
    )
    return without_marks.replace("đ", "d")


def model_text(text: str) -> str:
    """Add an accent-free view so the model handles typed Vietnamese without marks."""
    normalized = normalize_text(text)
    accent_free = remove_diacritics(normalized)
    return f"{normalized} __nodau__ {accent_free}"
