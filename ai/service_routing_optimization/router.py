"""FastAPI router for the Service Routing Optimization endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import (
    get_db,
    get_equipment_statuses,
    get_hospital_edges,
    get_journey_by_token,
    get_patient_current_location,
    get_pending_tasks,
    get_queue_wait_times,
)
from .optimization import find_optimal_sequence
from .schemas import (
    CostMetrics,
    OptimizeSequenceRequest,
    OptimizeSequenceResponse,
    SequenceItem,
)

router = APIRouter()

DEFAULT_START_LOCATION = "reception"


@router.post(
    "/optimize-sequence",
    response_model=OptimizeSequenceResponse,
    summary="Find the optimal service execution order",
    description=(
        "Generates all valid permutations of a patient's pending tasks, "
        "evaluates each using the multi-objective cost function "
        "(Travel + Queue + Priority), and returns the sequence with the "
        "lowest cost."
    ),
)
def optimize_sequence(
    request: OptimizeSequenceRequest,
    db: Session = Depends(get_db),
) -> OptimizeSequenceResponse:
    clinic_specialities = request.clinic_specialities
    patient_token = request.patient_token

    # 1. Validate journey exists by patient_token
    journey = get_journey_by_token(db, patient_token)
    if not journey:
        raise HTTPException(status_code=404, detail="Patient journey not found")
    
    journey_id = journey.id

    # 2. Fetch pending / ready tasks
    tasks = get_pending_tasks(db, journey_id, clinic_specialities)
    if not tasks:
        return OptimizeSequenceResponse(
            journey_id=journey_id,
            patient_token=patient_token,
            optimal_sequence=[],
            metrics=CostMetrics(
                total_cost=0.0,
                travel_cost=0.0,
                queue_cost=0.0,
                priority_penalty=0.0,
            ),
        )

    # 3. Verify patient_token matches
    for t in tasks:
        if t.patient_token != patient_token:
            raise HTTPException(
                status_code=422,
                detail="patient_token does not match the journey's tasks",
            )

    # 4. Gather data for the optimiser
    edges = get_hospital_edges(db)
    equipments = get_equipment_statuses(db)
    queues = get_queue_wait_times(db)

    # Determine the patient's current physical location
    current_location = (
        get_patient_current_location(db, journey_id) or DEFAULT_START_LOCATION
    )

    # Resolve clinical priority – use the highest priority across tasks
    priority_order = {"EMERGENCY": 0, "URGENT": 1, "NORMAL": 2, "NON_URGENT": 3}
    clinical_priority = min(
        (t.clinical_priority for t in tasks),
        key=lambda p: priority_order.get(p, 99),
    )

    # 5. Run optimisation
    optimal_tasks, metrics = find_optimal_sequence(
        tasks=tasks,
        edges=edges,
        queues=queues,
        equipments=equipments,
        current_location=current_location,
        clinical_priority=clinical_priority,
        checkin_at=journey.checkin_at,
    )

    if not optimal_tasks:
        raise HTTPException(
            status_code=422,
            detail="No valid service sequences available (all blocked by inactive equipment)",
        )

    # 6. Build response
    sequence_items = [
        SequenceItem(
            task_id=t.id,
            service_type=t.service_type or "",
            room_id=t.room_id or "",
            sequence_order=idx + 1,
        )
        for idx, t in enumerate(optimal_tasks)
    ]

    return OptimizeSequenceResponse(
        journey_id=journey_id,
        patient_token=patient_token,
        optimal_sequence=sequence_items,
        metrics=CostMetrics(**metrics),
    )
