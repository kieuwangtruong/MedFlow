from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


Gender = Literal["MALE", "FEMALE", "OTHER", "UNKNOWN"]
PregnancyStatus = Literal["YES", "NO", "NA", "UNKNOWN"]


class RoutingRequest(BaseModel):
    symptom_text: str = Field(min_length=5, max_length=2000)
    age: int = Field(ge=0, le=120)
    gender: Gender = "UNKNOWN"
    pregnancy_status: PregnancyStatus = "NA"
    top_k: int = Field(default=3, ge=2, le=3)
    available_department_codes: list[str] | None = None

    @field_validator("symptom_text")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Nội dung triệu chứng không được để trống")
        return value.strip()


class DepartmentPrediction(BaseModel):
    rank: int
    department_code: str
    department_name: str
    clinic_room: str
    confidence: float
    eligible: bool = True


class RedFlagInfo(BaseModel):
    code: str
    label: str
    matched_terms: list[str]


class RoutingResponse(BaseModel):
    normalized_text: str
    is_red_flag: bool
    priority: str
    action: str
    recommendations: list[DepartmentPrediction]
    confidence_low: bool
    requires_human_review: bool
    red_flag: RedFlagInfo | None = None
    message: str
    disclaimer: str = "Kết quả chỉ hỗ trợ phân loại khoa tiếp nhận, không phải chẩn đoán y khoa."
