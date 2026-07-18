const prisma = require('../../lib/prisma');

// Clinical severity score mapping
const SEVERITY_SCORES = {
  EMERGENCY: 100,
  URGENT: 50,
  NORMAL: 10,
  NON_URGENT: 10,
};

// Priority ordering for resolving highest priority across tasks
const PRIORITY_ORDER = {
  EMERGENCY: 0,
  URGENT: 1,
  NORMAL: 2,
  NON_URGENT: 3,
};

/**
 * Generates all permutations of an array.
 * Only suitable for small arrays (n <= 8).
 */
function generatePermutations(arr) {
  if (arr.length === 0) return [[]];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = generatePermutations(
      arr.slice(0, i).concat(arr.slice(i + 1))
    );
    for (const perm of rest) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

/**
 * Builds an adjacency list from hospital edge records.
 * Edges are treated as bidirectional.
 */
function buildGraph(edges) {
  const graph = {};
  for (const edge of edges) {
    if (!graph[edge.fromRoomId]) graph[edge.fromRoomId] = {};
    if (!graph[edge.toRoomId]) graph[edge.toRoomId] = {};
    graph[edge.fromRoomId][edge.toRoomId] = edge.travelMinutes;
    graph[edge.toRoomId][edge.fromRoomId] = edge.travelMinutes;
  }
  return graph;
}

/**
 * Dijkstra's shortest path algorithm.
 * Returns the shortest travel time between startNode and endNode.
 */
function shortestPath(graph, startNode, endNode) {
  if (startNode === endNode) return 0;
  if (!graph[startNode] || !graph[endNode]) return 999999;

  const distances = {};
  const visited = new Set();

  for (const node in graph) {
    distances[node] = Infinity;
  }
  distances[startNode] = 0;

  while (true) {
    let minNode = null;
    let minDistance = Infinity;

    for (const node in distances) {
      if (!visited.has(node) && distances[node] < minDistance) {
        minDistance = distances[node];
        minNode = node;
      }
    }

    if (minNode === null || minNode === endNode) break;

    visited.add(minNode);

    for (const neighbor in graph[minNode]) {
      const alt = distances[minNode] + graph[minNode][neighbor];
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
      }
    }
  }

  return distances[endNode] === Infinity ? 999999 : distances[endNode];
}

/**
 * Main optimisation function.
 *
 * Cost = 0.20 * T_norm + 0.30 * Q_norm + 0.50 * P_norm
 */
async function optimizeServiceSequence(journeyId, patientToken) {
  // 1. Fetch and validate journey
  const journey = await prisma.patientJourney.findFirst({
    where: { id: journeyId, patientToken },
  });

  if (!journey) {
    const error = new Error('Journey not found or patient_token mismatch');
    error.statusCode = 404;
    throw error;
  }

  // 2. Fetch pending tasks
  const pendingTasks = await prisma.patientJourneyTask.findMany({
    where: {
      journeyId,
      status: { in: ['PENDING', 'READY'] },
    },
  });

  if (pendingTasks.length === 0) {
    return {
      journey_id: journeyId,
      patient_token: patientToken,
      optimal_sequence: [],
      metrics: {
        total_cost: 0,
        travel_cost: 0,
        queue_cost: 0,
        priority_penalty: 0,
      },
    };
  }

  // 3. Fetch hospital graph
  const edges = await prisma.hospitalEdge.findMany();
  const graph = buildGraph(edges);

  // 4. Fetch equipment statuses (build set of inactive rooms)
  const equipments = await prisma.equipment.findMany();
  const inactiveRooms = new Set(
    equipments
      .filter((eq) => eq.status === 'INACTIVE' && eq.roomId)
      .map((eq) => eq.roomId)
  );

  // 5. Fetch queue wait times
  const queues = await prisma.serviceQueue.findMany({
    where: { isActive: true },
  });
  const queueByRoom = {};
  for (const q of queues) {
    if (q.roomId) {
      queueByRoom[q.roomId] = q.estimatedWaitMinutes || 0;
    }
  }

  // 6. Determine patient's current location
  const lastTask = await prisma.patientJourneyTask.findFirst({
    where: {
      journeyId,
      status: { in: ['IN_SERVICE', 'COMPLETED'] },
      roomId: { not: null },
    },
    orderBy: { completedAt: 'desc' },
  });
  const currentLocation = (lastTask && lastTask.roomId) || 'reception';

  // 7. Resolve highest clinical priority across tasks
  const clinicalPriority = pendingTasks.reduce((highest, task) => {
    const currentOrder = PRIORITY_ORDER[highest] ?? 99;
    const taskOrder = PRIORITY_ORDER[task.clinicalPriority] ?? 99;
    return taskOrder < currentOrder ? task.clinicalPriority : highest;
  }, 'NORMAL');

  // 8. Calculate priority penalty (constant for this patient)
  const checkinAt = journey.checkinAt ? new Date(journey.checkinAt) : null;
  const now = Date.now();
  const waitMinutes = checkinAt
    ? Math.max(0, (now - checkinAt.getTime()) / 60000)
    : 0;
  const cs = SEVERITY_SCORES[clinicalPriority] || 10;
  const ps = 1.0 * cs + 1.5 * waitMinutes;
  const pNorm = 1 - Math.min(ps / 200, 1);

  // 9. Generate permutations and evaluate
  const permutations = generatePermutations(pendingTasks);
  const candidates = [];

  for (const seq of permutations) {
    // Filter: skip sequences with any INACTIVE equipment room
    let hasInactive = false;
    for (const task of seq) {
      if (task.roomId && inactiveRooms.has(task.roomId)) {
        hasInactive = true;
        break;
      }
    }
    if (hasInactive) continue;

    // Calculate travel cost
    let T = 0;
    let prev = currentLocation;
    for (const task of seq) {
      if (task.roomId) {
        T += shortestPath(graph, prev, task.roomId);
        prev = task.roomId;
      }
    }

    // Calculate queue cost
    let Q = 0;
    for (const task of seq) {
      if (task.roomId) {
        Q += queueByRoom[task.roomId] || 0;
      }
    }

    candidates.push({ sequence: seq, T, Q });
  }

  if (candidates.length === 0) {
    const error = new Error(
      'No valid service sequences available (all blocked by inactive equipment)'
    );
    error.statusCode = 422;
    throw error;
  }

  // 10. Normalise and find minimum cost
  const maxT = Math.max(...candidates.map((c) => c.T), 1);
  const maxQ = Math.max(...candidates.map((c) => c.Q), 1);

  let bestCandidate = null;
  let minCost = Infinity;

  for (const candidate of candidates) {
    const tNorm = candidate.T / maxT;
    const qNorm = candidate.Q / maxQ;
    const cost = 0.2 * tNorm + 0.3 * qNorm + 0.5 * pNorm;

    if (cost < minCost) {
      minCost = cost;
      bestCandidate = candidate;
    }
  }

  // 11. Update sequenceOrder in DB
  const optimalSequence = bestCandidate.sequence.map((task, index) => ({
    task_id: task.id,
    service_type: task.serviceType,
    room_id: task.roomId,
    sequence_order: index + 1,
  }));

  await Promise.all(
    optimalSequence.map((item) =>
      prisma.patientJourneyTask.update({
        where: { id: item.task_id },
        data: { sequenceOrder: item.sequence_order },
      })
    )
  );

  return {
    journey_id: journeyId,
    patient_token: patientToken,
    optimal_sequence: optimalSequence,
    metrics: {
      total_cost: Math.round(minCost * 1e6) / 1e6,
      travel_cost: Math.round(bestCandidate.T * 100) / 100,
      queue_cost: Math.round(bestCandidate.Q * 100) / 100,
      priority_penalty: Math.round(pNorm * 1e6) / 1e6,
    },
  };
}

module.exports = {
  optimizeServiceSequence,
};
