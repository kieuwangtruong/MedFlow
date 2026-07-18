from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    app_name: str = "Vietnamese Symptom Department Router"
    app_version: str = "1.0.0"
    host: str = "0.0.0.0"
    port: int = 8001
    confidence_threshold: float = 0.45
    top_k_default: int = 3
    model_path: str = "models/clinic_room_router.joblib"
    metadata_path: str = "models/model_metadata.json"
    departments_path: str = "data/departments.csv"

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def model_file(self) -> Path:
        return PROJECT_ROOT / self.model_path

    @property
    def metadata_file(self) -> Path:
        return PROJECT_ROOT / self.metadata_path

    @property
    def departments_file(self) -> Path:
        return PROJECT_ROOT / self.departments_path


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
