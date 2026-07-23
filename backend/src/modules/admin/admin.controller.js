const { z } = require('zod');
const asyncHandler = require('../../utils/async-handler');
const service = require('./admin.service');

const dashboard = asyncHandler(async (_req, res) => res.json(await service.getDashboard()));
const liveVisits = asyncHandler(async (_req, res) => res.json(await service.getLiveVisits()));
const rooms = asyncHandler(async (_req, res) => res.json(await service.getRooms()));
const doctors = asyncHandler(async (_req, res) => res.json(await service.getDoctors()));
const updateRoomStatus = asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(['OPEN', 'PAUSED', 'CLOSED']) }).parse(req.body);
  res.json(await service.updateRoomStatus(req.params.roomId, status));
});

module.exports = { dashboard, doctors, liveVisits, rooms, updateRoomStatus };
