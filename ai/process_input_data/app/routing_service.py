from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .model import ModelContainer
from .preprocessing import model_text, normalize_text
from .red_flags import detect_red_flag
from .schemas import DepartmentPrediction, RoutingRequest, RoutingResponse


@dataclass(frozen=True)
class Department:
    code: str
    name: str
    age_min: int
    age_max: int
    gender_scope: str
    is_active: bool


class RoutingService:
    def __init__(
        self,
        container: ModelContainer,
        departments_path,
        confidence_threshold: float,
    ) -> None:
        self.container = container
        self.confidence_threshold = confidence_threshold
        frame = pd.read_csv(departments_path, encoding="utf-8-sig")
        self.departments = {
            row.department_code: Department(
                code=row.department_code,
                name=row.department_name,
                age_min=int(row.age_min),
                age_max=int(row.age_max),
                gender_scope=str(row.gender_scope).upper(),
                is_active=str(row.is_active).lower() == "true",
            )
            for row in frame.itertuples(index=False)
        }

    def _eligible(self, code: str, request: RoutingRequest) -> bool:
        department = self.departments.get(code)
        if department is None or not department.is_active:
            return False
        if not department.age_min <= request.age <= department.age_max:
            return False
        if department.gender_scope not in {"ALL", request.gender}:
            return False
        if request.available_department_codes is not None:
            return code in request.available_department_codes
        return True

    def _prediction(self, rank: int, code: str, confidence: float) -> DepartmentPrediction:
        department = self.departments.get(code)
        return DepartmentPrediction(
            rank=rank,
            department_code=code,
            department_name=department.name if department else code,
            confidence=round(float(confidence), 4),
        )

    def route(self, request: RoutingRequest) -> RoutingResponse:
        normalized = normalize_text(request.symptom_text)
        red_flag = detect_red_flag(request.symptom_text, request.pregnancy_status)
        if red_flag:
            return RoutingResponse(
                normalized_text=normalized,
                is_red_flag=True,
                priority=red_flag.priority,
                action="EMERGENCY_ROUTE",
                recommendations=[self._prediction(1, "ER", 1.0)],
                confidence_low=False,
                requires_human_review=True,
                red_flag={
                    "code": red_flag.code,
                    "label": red_flag.label,
                    "matched_terms": red_flag.matched_terms,
                },
                message="Phát hiện dấu hiệu nguy hiểm: chuyển Cấp cứu và yêu cầu nhân viên xác nhận ngay.",
            )

        pipeline = self.container.pipeline
        if pipeline is None:
            raise RuntimeError("Model chưa được load")

        probabilities = pipeline.predict_proba([model_text(request.symptom_text)])[0]
        classes = pipeline.classes_
        sorted_indices = np.argsort(probabilities)[::-1]
        eligible = [
            (str(classes[index]), float(probabilities[index]))
            for index in sorted_indices
            if self._eligible(str(classes[index]), request)
        ]

        if request.age < 16 and self._eligible("PED", request):
            pediatric_probability = next((score for code, score in eligible if code == "PED"), 0.0)
            eligible = [(code, score) for code, score in eligible if code != "PED"]
            eligible.insert(0, ("PED", max(pediatric_probability, 0.8)))

        selected = eligible[: request.top_k]
        top_confidence = selected[0][1] if selected else 0.0
        confidence_low = top_confidence < self.confidence_threshold

        if not selected or confidence_low:
            general_score = max(top_confidence, self.confidence_threshold)
            selected = [(code, score) for code, score in selected if code != "GENERAL"]
            if self._eligible("GENERAL", request):
                selected.insert(0, ("GENERAL", general_score))
            selected = selected[: request.top_k]

        recommendations = [
            self._prediction(rank, code, score)
            for rank, (code, score) in enumerate(selected, start=1)
        ]
        return RoutingResponse(
            normalized_text=normalized,
            is_red_flag=False,
            priority="NORMAL",
            action="HUMAN_REVIEW" if confidence_low else "DEPARTMENT_ROUTING",
            recommendations=recommendations,
            confidence_low=confidence_low,
            requires_human_review=confidence_low,
            message=(
                "Độ tin cậy thấp: chuyển Nội tổng quát và yêu cầu nhân viên xác nhận."
                if confidence_low
                else "Đã phân loại các khoa tiếp nhận phù hợp."
            ),
        )
