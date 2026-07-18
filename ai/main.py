from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from peak_hour_prediction.app.api.forecast import router as forecast_router
from peak_hour_prediction.app.ml.model_loader import (
    model_container as forecast_model_container,
)
from process_input_data.app.config import settings as routing_settings
from process_input_data.app.model import (
    model_container as routing_model_container,
)
from process_input_data.app.routing_service import RoutingService
from process_input_data.app.schemas import RoutingRequest, RoutingResponse
from wait_time_module.app.main import app as wait_time_app
from service_routing_optimization.router import router as routing_optimization_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    forecast_model_container.load()
    routing_model_container.load(
        routing_settings.model_file,
        routing_settings.metadata_file,
    )

    # Forecast router giữ contract cũ qua app.state.model_container.
    app.state.model_container = forecast_model_container
    app.state.routing_service = RoutingService(
        container=routing_model_container,
        departments_path=routing_settings.departments_file,
        confidence_threshold=routing_settings.confidence_threshold,
    )
    yield


app = FastAPI(
    title="Smart Hospital Unified AI API",
    version="1.0.0",
    description=(
        "Một service chung cho dự báo khung giờ cao điểm và "
        "phân loại khoa tiếp nhận từ triệu chứng."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast_router)
app.include_router(wait_time_app.router, tags=["Wait Time & Queue"])
app.include_router(
    routing_optimization_router,
    prefix="/api/v1/routing",
    tags=["Service Routing Optimization"],
)


@app.get("/", tags=["System"])
def root() -> dict:
    return {
        "message": "Smart Hospital Unified AI API",
        "docs": "/docs",
        "services": [
            "peak_hour_prediction",
            "symptom_routing",
            "wait_time_and_queue",
            "service_routing_optimization",
        ],
    }


@app.post(
    "/api/v1/symptom-routing",
    response_model=RoutingResponse,
    tags=["Symptom Routing"],
)
@app.post(
    "/api/v1/ai/symptom-routing",
    response_model=RoutingResponse,
    tags=["Symptom Routing"],
    include_in_schema=False,
)
def symptom_routing(payload: RoutingRequest) -> RoutingResponse:
    try:
        service: RoutingService = app.state.routing_service
        return service.route(payload)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error
