from __future__ import annotations

from process_input_data.app.config import settings
from process_input_data.app.model import ModelContainer
from process_input_data.app.red_flags import detect_red_flag
from process_input_data.app.routing_service import RoutingService
from process_input_data.app.schemas import RoutingRequest


def build_service() -> RoutingService:
    container = ModelContainer()
    container.load(settings.model_file, settings.metadata_file)
    return RoutingService(
        container,
        settings.departments_file,
        settings.confidence_threshold,
    )


def test_red_flag_routes_to_emergency() -> None:
    result = build_service().route(
        RoutingRequest(
            symptom_text="Đau ngực bóp nghẹt kèm khó thở",
            age=64,
            gender="MALE",
            top_k=3,
        )
    )
    assert result.is_red_flag
    assert result.recommendations[0].department_code == "ER"
    assert result.requires_human_review


def test_negated_seizure_is_not_red_flag() -> None:
    assert detect_red_flag("Tôi không có cơn co giật") is None


def test_returns_top_three_departments() -> None:
    result = build_service().route(
        RoutingRequest(
            symptom_text="Tôi ho kéo dài, khò khè và hơi khó thở khi vận động",
            age=36,
            gender="FEMALE",
            pregnancy_status="NO",
            top_k=3,
        )
    )
    assert not result.is_red_flag
    assert 2 <= len(result.recommendations) <= 3


def test_child_is_routed_to_pediatrics() -> None:
    result = build_service().route(
        RoutingRequest(
            symptom_text="Bé bị ho và sốt nhẹ hai ngày",
            age=8,
            gender="MALE",
            top_k=3,
        )
    )
    assert result.recommendations[0].department_code == "PED"
