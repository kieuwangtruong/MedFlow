const asyncHandler = require('../../utils/async-handler');
const adminService = require('../admin/admin.service');
const { toDatabasePriority } = require('../shared/presenters');
const { requestAi } = require('./ai-client');

const health = asyncHandler(async (_req, res) => {
  res.json(await requestAi('/api/v1/health'));
});

const forecasts = asyncHandler(async (req, res) => {
  res.json(await requestAi('/api/v1/forecasts', { method: 'POST', body: req.body }));
});

const roomsStatus = asyncHandler(async (_req, res) => {
  res.json(await requestAi('/api/v1/rooms/status'));
});

const roomOptions = asyncHandler(async (req, res) => {
  res.json(await requestAi('/api/v1/estimates/room-options', { method: 'POST', body: req.body }));
});

const patientEstimate = asyncHandler(async (req, res) => {
  const token = encodeURIComponent(req.params.patientToken);
  res.json(await requestAi(`/api/v1/patients/${token}/estimate`));
});

const journeyEstimate = asyncHandler(async (req, res) => {
  const journeyId = encodeURIComponent(req.params.journeyId);
  res.json(await requestAi(`/api/v1/journeys/${journeyId}/estimate`));
});

const events = asyncHandler(async (req, res) => {
  res.json(await requestAi('/api/v1/events', { method: 'POST', body: req.body }));
});

const assignmentImpact = asyncHandler(async (req, res) => {
  res.json(await requestAi('/api/v1/estimates/assignment-impact', { method: 'POST', body: req.body }));
});

const scenario = asyncHandler(async (req, res) => {
  res.json(await requestAi('/api/v1/simulations/scenario', { method: 'POST', body: req.body }));
});

function serviceCode(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized.includes('siêu âm')) return 'ABDOMINAL_ULTRASOUND';
  if (normalized.includes('x-quang')) return 'XRAY';
  return 'CLINICAL_CONSULT';
}

const fastestRoom = asyncHandler(async (req, res) => {
  const allRooms = await adminService.getRooms();
  const department = String(req.body.targetDepartment || '').toLowerCase();
  const matchingRooms = allRooms.filter((room) => (
    room.status === 'OPEN' && (!department || room.department.toLowerCase().includes(department))
  ));
  const candidates = matchingRooms.length
    ? matchingRooms
    : allRooms.filter((room) => room.status === 'OPEN');
  if (!candidates.length) return res.json([]);

  let options = [];
  try {
    const response = await requestAi('/api/v1/estimates/room-options', {
      method: 'POST',
      body: {
        request_id: `frontend-${Date.now()}`,
        patient_token: req.auth.patient_token || req.auth.sub,
        task_type: 'DIAGNOSTIC_SERVICE',
        service_code: serviceCode(req.body.type),
        clinical_priority: toDatabasePriority(req.body.priority),
        ready_at: new Date().toISOString(),
        candidate_room_ids: candidates.map((room) => room.id),
        dry_run: true,
      },
    });
    options = response.options || [];
  } catch {
    options = [];
  }

  const optionByRoom = new Map(options.map((option) => [option.room_id, option]));
  const ranked = candidates.map((room) => {
    const option = optionByRoom.get(room.id);
    const aiWait = option?.estimate_status === 'OK' ? option.ewt?.p50_minutes : null;
    return {
      ...room,
      waitingCount: option?.queue_ahead ?? room.waitingCount,
      averageWait: aiWait ?? room.averageWait,
    };
  }).sort((left, right) => left.averageWait - right.averageWait || left.waitingCount - right.waitingCount);

  res.json(ranked);
});

module.exports = {
  assignmentImpact,
  events,
  fastestRoom,
  forecasts,
  health,
  journeyEstimate,
  patientEstimate,
  roomOptions,
  roomsStatus,
  scenario,
};
