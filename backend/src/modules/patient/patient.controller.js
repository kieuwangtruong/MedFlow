const { z } = require('zod');
const asyncHandler = require('../../utils/async-handler');
const service = require('./patient.service');

const checkinSchema = z.object({
  examinationType: z.string().min(1),
  patientType: z.string().min(1),
});

const symptomSchema = z.object({
  description: z.string().min(1),
  onset: z.string().optional().default(''),
  painLevel: z.number().min(0).max(10),
  commonSymptoms: z.array(z.string()).default([]),
  dangerSigns: z.array(z.string()).default([]),
});

const routingSchema = z.object({
  department: z.string().optional(),
  room: z.string().min(1),
  estimatedWait: z.number().min(0).optional(),
  source: z.string().optional(),
});

const kioskSchema = z.object({
  cccd: z.string().regex(/^\d{9,12}$/),
  fullName: z.string().trim().min(2).max(100),
  examinationType: z.string().default('GENERAL'),
  patientType: z.string().default('INSURANCE'),
});

const checkin = asyncHandler(async (req, res) => {
  const payload = checkinSchema.parse(req.body);
  res.status(201).json(await service.checkin(req.auth.patient_token, payload));
});

const submitSymptoms = asyncHandler(async (req, res) => {
  const payload = symptomSchema.parse(req.body);
  res.json(await service.submitSymptoms(req.auth.patient_token, req.params.visitId, payload));
});

const confirmRouting = asyncHandler(async (req, res) => {
  const payload = routingSchema.parse(req.body);
  res.json(await service.confirmRouting(req.auth.patient_token, req.params.visitId, payload));
});

const kioskCheckin = asyncHandler(async (req, res) => {
  const { cccd, fullName, ...payload } = kioskSchema.parse(req.body);
  res.status(201).json(await service.kioskCheckin(cccd, fullName, payload));
});

const pathway = asyncHandler(async (req, res) => {
  res.json(await service.getPathway(req.auth.patient_token, req.params.visitId));
});

const results = asyncHandler(async (req, res) => {
  res.json(await service.getResults(req.auth.patient_token, req.params.visitId));
});

const notifications = asyncHandler(async (req, res) => {
  res.json(await service.getNotifications(req.auth.patient_token));
});

module.exports = {
  checkin,
  confirmRouting,
  kioskCheckin,
  notifications,
  pathway,
  results,
  submitSymptoms,
};
