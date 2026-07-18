from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib


class ModelContainer:
    def __init__(self) -> None:
        self.pipeline: Any | None = None
        self.metadata: dict[str, Any] | None = None

    def load(self, model_path: Path, metadata_path: Path) -> None:
        if not model_path.exists():
            raise FileNotFoundError(
                f"Không tìm thấy model tại {model_path}. Hãy chạy: python train.py"
            )
        if not metadata_path.exists():
            raise FileNotFoundError(f"Không tìm thấy metadata tại {metadata_path}")
        self.pipeline = joblib.load(model_path)
        self.metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

    def is_ready(self) -> bool:
        return self.pipeline is not None and self.metadata is not None


model_container = ModelContainer()
