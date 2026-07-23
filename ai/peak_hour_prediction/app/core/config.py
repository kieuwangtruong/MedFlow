from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Smart Hospital Peak Hour Forecast API"
    app_version: str = "1.0.0"
    app_env: str = "development"
    debug: bool = False

    api_prefix: str = "/api/v1"
    host: str = "0.0.0.0"
    port: int = 8000

    model_path: str = Field(
        default="models/checkin_forecast_model.joblib",
        validation_alias=AliasChoices("FORECAST_MODEL_PATH", "MODEL_PATH"),
    )
    model_metadata_path: str = Field(
        default="models/model_metadata.json",
        validation_alias=AliasChoices("FORECAST_MODEL_METADATA_PATH", "MODEL_METADATA_PATH")
    )
    checkin_data_path: str = Field(
        default="data/checkin_slots_2026_06.csv",
        validation_alias=AliasChoices("FORECAST_CHECKIN_DATA_PATH", "CHECKIN_DATA_PATH")
    )

    forecast_max_days: int = Field(
        default=7,
        ge=1,
        le=30,
    )

    cors_origins: str = ""

    # Cho phép không cấu hình database trong giai đoạn dùng CSV
    database_url: str | None = None

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def model_file(self) -> Path:
        return PROJECT_ROOT / self.model_path

    @property
    def metadata_file(self) -> Path:
        return PROJECT_ROOT / self.model_metadata_path

    @property
    def checkin_data_file(self) -> Path:
        return PROJECT_ROOT / self.checkin_data_path

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
