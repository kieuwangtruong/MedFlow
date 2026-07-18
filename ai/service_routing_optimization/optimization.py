"""Multi-objective service sequence optimization engine.

Implements the cost function:
    Cost = 0.20 * T_norm + 0.30 * Q_norm + 0.50 * P_norm

Where:
    T = Travel cost (sum of shortest-path travel minutes)
    Q = Queue cost  (sum of estimated wait minutes)
    P = Priority penalty (derived from clinical severity + waiting time)

Candidate sequences containing rooms with INACTIVE equipment are eliminated.
"""

from __future__ import annotations

import heapq
import itertools
from datetime import datetime, timezone
from typing import Any


# ---------------------------------------------------------------------------
# Hospital graph helpers
# ---------------------------------------------------------------------------


def build_graph(edges: list[Any]) -> dict[str, dict[str, float]]:
    """Build an adjacency list from hospital edge records.

    Edges are treated as **bidirectional** since patients can walk both ways
    through hospital corridors.
    """
    graph: dict[str, dict[str, float]] = {}
    for edge in edges:
        graph.setdefault(edge.from_room_id, {})
        graph.setdefault(edge.to_room_id, {})
        graph[edge.from_room_id][edge.to_room_id] = edge.travel_minutes
        graph[edge.to_room_id][edge.from_room_id] = edge.travel_minutes
    return graph


def dijkstra(
    graph: dict[str, dict[str, float]], source: str, target: str
) -> float:
    """Return the shortest travel time between *source* and *target*.

    Uses a min-heap priority queue for efficient traversal.
    Returns ``float('inf')`` if no path exists.
    """
    if source == target:
        return 0.0
    if source not in graph or target not in graph:
        return float("inf")

    distances: dict[str, float] = {node: float("inf") for node in graph}
    distances[source] = 0.0
    pq: list[tuple[float, str]] = [(0.0, source)]

    while pq:
        curr_dist, curr_node = heapq.heappop(pq)

        if curr_dist > distances[curr_node]:
            continue
        if curr_node == target:
            return curr_dist

        for neighbor, weight in graph[curr_node].items():
            new_dist = curr_dist + weight
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                heapq.heappush(pq, (new_dist, neighbor))

    return distances[target]


# ---------------------------------------------------------------------------
# Individual cost components
# ---------------------------------------------------------------------------

# A large but finite fallback when two rooms are not connected in the graph.
_UNREACHABLE_PENALTY = 999.0


def calculate_travel_cost(
    sequence: list[Any],
    graph: dict[str, dict[str, float]],
    current_location: str,
) -> float:
    """Sum of shortest-path travel minutes from *current_location* through
    each task's room in order."""
    cost = 0.0
    prev = current_location
    for task in sequence:
        room = task.room_id
        if room:
            dist = dijkstra(graph, prev, room)
            cost += _UNREACHABLE_PENALTY if dist == float("inf") else dist
            prev = room
    return cost


def calculate_queue_cost(
    sequence: list[Any], queue_times: dict[str, float]
) -> float:
    """Sum of estimated wait minutes for each service's room/queue."""
    return sum(queue_times.get(t.room_id, 0.0) for t in sequence if t.room_id)


def calculate_priority_penalty(
    clinical_priority: str,
    checkin_at: datetime | None,
    now: datetime,
) -> float:
    """Compute the normalised priority penalty P ∈ [0, 1].

    Formula:
        PS = 1.0 × CS + 1.5 × WT
        P  = 1 − min(PS / 200, 1)

    A **higher** priority patient receives a **lower** penalty, which makes
    routes serving them cost less and therefore get selected.
    """
    cs_map = {
        "EMERGENCY": 100,
        "URGENT": 50,
        "NORMAL": 10,
        "NON_URGENT": 10,
    }
    cs = cs_map.get(clinical_priority, 10)

    wt = 0.0
    if checkin_at is not None:
        # Ensure both datetimes are comparable (tz-aware vs naive).
        if checkin_at.tzinfo is None:
            now_cmp = now.replace(tzinfo=None)
        else:
            now_cmp = now
        wt = max(0.0, (now_cmp - checkin_at).total_seconds() / 60.0)

    ps = 1.0 * cs + 1.5 * wt
    return 1.0 - min(ps / 200.0, 1.0)


# ---------------------------------------------------------------------------
# Equipment filtering
# ---------------------------------------------------------------------------


def has_inactive_equipment(
    sequence: list[Any],
    inactive_rooms: set[str],
) -> bool:
    """Return True if *any* task in the sequence targets a room whose
    equipment is INACTIVE."""
    return any(t.room_id in inactive_rooms for t in sequence if t.room_id)


# ---------------------------------------------------------------------------
# Main optimiser
# ---------------------------------------------------------------------------


def find_optimal_sequence(
    tasks: list[Any],
    edges: list[Any],
    queues: list[Any],
    equipments: list[Any],
    current_location: str,
    clinical_priority: str,
    checkin_at: datetime | None,
) -> tuple[list[Any], dict[str, float]]:
    """Find the task ordering that minimises the weighted cost.

    Steps:
        1. Build the hospital graph and lookup tables.
        2. Generate all permutations of *tasks*.
        3. Eliminate permutations that pass through rooms with INACTIVE
           equipment.
        4. Evaluate travel, queue, and priority costs.
        5. Normalise T and Q across candidates and compute weighted sum.
        6. Return the best permutation and its cost breakdown.

    Returns a tuple of (ordered_tasks, metrics_dict).
    """
    empty_metrics = {
        "total_cost": 0.0,
        "travel_cost": 0.0,
        "queue_cost": 0.0,
        "priority_penalty": 0.0,
    }

    if not tasks:
        return [], empty_metrics

    # Build lookup structures ------------------------------------------------
    graph = build_graph(edges)
    queue_times: dict[str, float] = {
        q.room_id: (q.estimated_wait_minutes or 0.0)
        for q in queues
        if q.room_id
    }
    inactive_rooms: set[str] = {
        eq.room_id for eq in equipments if eq.status == "INACTIVE" and eq.room_id
    }

    now = datetime.now(timezone.utc)

    # Priority penalty is constant across permutations for the same patient.
    p_norm = calculate_priority_penalty(clinical_priority, checkin_at, now)

    # Evaluate all candidate permutations ------------------------------------
    candidates: list[tuple[tuple[Any, ...], float, float]] = []

    for perm in itertools.permutations(tasks):
        # Filter: skip entire permutation if any room has inactive equipment.
        if has_inactive_equipment(perm, inactive_rooms):
            continue

        t = calculate_travel_cost(perm, graph, current_location)
        q = calculate_queue_cost(perm, queue_times)
        candidates.append((perm, t, q))

    if not candidates:
        return [], empty_metrics

    # Normalise T and Q across all candidates --------------------------------
    max_t = max((c[1] for c in candidates), default=1.0)
    max_q = max((c[2] for c in candidates), default=1.0)
    max_t = max(max_t, 1.0)  # avoid division by zero
    max_q = max(max_q, 1.0)

    # Select the permutation with the minimum weighted cost ------------------
    best_perm: tuple[Any, ...] | None = None
    best_cost = float("inf")
    best_t = 0.0
    best_q = 0.0

    for perm, t, q in candidates:
        t_norm = t / max_t
        q_norm = q / max_q
        cost = 0.20 * t_norm + 0.30 * q_norm + 0.50 * p_norm

        if cost < best_cost:
            best_cost = cost
            best_perm = perm
            best_t = t
            best_q = q

    if best_perm is None:
        return [], empty_metrics

    return list(best_perm), {
        "total_cost": round(best_cost, 6),
        "travel_cost": round(best_t, 2),
        "queue_cost": round(best_q, 2),
        "priority_penalty": round(p_norm, 6),
    }
