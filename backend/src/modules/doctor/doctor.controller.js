const { z } = require('zod');
const asyncHandler = require('../../utils/async-handler');
const service = require('./doctor.service');

const prioritySchema = z.enum(['EMERGENCY', 'URGENT', 'HIGH', 'NORMAL', 'LOW']);
const orderSchema = z.object({
  type: z.enum(['X-quang', 'Siêu âm']),
  targetDepartment: z.string().min(1),
  priority: prioritySchema,
  clinicalNote: z.string().min(5),
  specialRequest: z.string().optional(),
  room: z.string().optional(),
  useAI: z.boolean().optional(),
});

const intakeSchema = z.object({
  cccd: z.string().regex(/^\d{9,12}$/),
  name: z.string().min(2),
  age: z.number().int().min(0).max(120),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']),
  pregnancyStatus: z.enum(['YES', 'NO', 'NA', 'UNKNOWN']),
  department: z.string().optional(),
  room: z.string().min(1),
  estimatedWait: z.number().min(0).optional(),
  symptomReport: z.object({
    description: z.string().min(5),
    onset: z.string().optional().default(''),
    painLevel: z.number().min(0).max(10),
    commonSymptoms: z.array(z.string()).default([]),
    dangerSigns: z.array(z.string()).default([]),
  }),
});

const assignment = asyncHandler(async (req, res) => res.json(await service.getAssignment(req.auth)));
const queue = asyncHandler(async (req, res) => res.json(await service.getQueue(req.auth)));
const intake = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createIntake(intakeSchema.parse(req.body)));
});
const visit = asyncHandler(async (req, res) => res.json(await service.getVisit(req.params.visitId, req.auth)));
const updatePriority = asyncHandler(async (req, res) => {
  const { priority } = z.object({ priority: prioritySchema }).parse(req.body);
  res.json(await service.updatePriority(req.params.visitId, priority, req.auth));
});
const callVisit = asyncHandler(async (req, res) => res.json(await service.callVisit(req.params.visitId, req.auth)));
const startVisit = asyncHandler(async (req, res) => res.json(await service.startVisit(req.params.visitId, req.auth)));
const createOrder = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createOrder(req.params.visitId, orderSchema.parse(req.body), req.auth));
});
const completeVisit = asyncHandler(async (req, res) => res.json(await service.completeVisit(req.params.visitId, req.auth)));
const validateResult = asyncHandler(async (req, res) => res.json(await service.validateResult(req.params.visitId, req.auth)));

module.exports = {
  assignment,
  callVisit,
  completeVisit,
  createOrder,
  intake,
  queue,
  startVisit,
  updatePriority,
  validateResult,
  visit,
};
