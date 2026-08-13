const asyncHandler = require('../../utils/async-handler');
const AppError = require('../../errors/app-error');
const adminService = require('../admin/admin.service');
const doctorService = require('../doctor/doctor.service');
const { toDatabasePriority } = require('../shared/presenters');
const { getServiceDefinition, normalizeText } = require('../shared/service-routing');
const { requestAi } = require('./ai-client');

const health = asyncHandler(async (_req, res) => {
  res.json(await requestAi('/health/live'));
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

function selectCandidateRooms(allRooms, targetDepartment, excludedRoomId, serviceType) {
  const department = normalizeText(targetDepartment);
  const compatibleRooms = allRooms.filter((room) => (
    room.status === 'OPEN' && room.id !== excludedRoomId
    && room.serviceTypes?.includes(serviceType)
  ));
  return compatibleRooms.filter((room) => (
    !department || normalizeText(room.department).includes(department)
  ));
}

const fastestRoom = asyncHandler(async (req, res) => {
  const service = getServiceDefinition(req.body.type);
  if (!service) {
    throw new AppError('Dịch vụ này chưa được cấu hình phòng thực hiện', 422, 'UNSUPPORTED_SERVICE');
  }
  const allRooms = await adminService.getRooms();
  const currentRoomId = req.body.visitId
    ? await doctorService.getCurrentRoomId(req.body.visitId, req.auth)
    : null;
  const candidates = selectCandidateRooms(
    allRooms,
    service.department,
    currentRoomId,
    service.serviceType,
  ).map((room) => ({
    ...room,
    averageWait: room.serviceMetrics?.[service.serviceType]?.averageWait ?? room.averageWait,
    waitingCount: room.serviceMetrics?.[service.serviceType]?.waitingCount ?? room.waitingCount,
  }));
  if (!candidates.length) {
    throw new AppError(
      `Không có phòng đang mở hỗ trợ ${service.label}`,
      422,
      'COMPATIBLE_ROOM_NOT_FOUND',
    );
  }

  let options = [];
  try {
    const response = await requestAi('/api/v1/estimates/room-options', {
      method: 'POST',
      body: {
        request_id: `frontend-${Date.now()}`,
        patient_token: req.auth.patient_token || req.auth.sub,
        task_type: 'DIAGNOSTIC_SERVICE',
        service_code: service.serviceType,
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
  selectCandidateRooms,
};
