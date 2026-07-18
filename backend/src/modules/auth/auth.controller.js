const { z } = require('zod');

const AppError = require('../../errors/app-error');
const asyncHandler = require('../../utils/async-handler');
const authService = require('./auth.service');

const loginSchema = z.object({
  cccd: z.string().regex(/^\d{9,12}$/, 'CCCD must contain 9 to 12 digits').optional(),
  identifier: z.string().regex(/^\d{9,12}$/, 'CCCD must contain 9 to 12 digits').optional(),
}).refine((value) => value.cccd || value.identifier, {
  message: 'CCCD is required',
});

const staffLoginSchema = z.object({
  userName: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  password: z.string().min(1),
}).refine((value) => value.userName || value.email, {
  message: 'Username is required',
});

const login = asyncHandler(async (req, res) => {
  const validation = loginSchema.safeParse(req.body);
  if (!validation.success) {
    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', validation.error.flatten());
  }

  const payload = validation.data;
  const result = await authService.loginWithCccd(payload.cccd || payload.identifier);

  res.json(result);
});

const staffLogin = asyncHandler(async (req, res) => {
  const validation = staffLoginSchema.safeParse(req.body);
  if (!validation.success) {
    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', validation.error.flatten());
  }

  const result = await authService.loginStaff(
    validation.data.userName || validation.data.email,
    validation.data.password
  );

  res.json(result);
});

module.exports = {
  login,
  staffLogin,
};
