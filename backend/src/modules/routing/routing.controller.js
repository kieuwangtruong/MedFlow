const { z } = require('zod');
const routingService = require('./routing.service');

const optimizeSequenceSchema = z.object({
  journey_id: z.string().min(1),
  patient_token: z.string().min(1),
});

const optimizeSequence = async (req, res, next) => {
  try {
    const validatedData = optimizeSequenceSchema.parse(req.body);
    const result = await routingService.optimizeServiceSequence(
      validatedData.journey_id,
      validatedData.patient_token
    );
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
};

module.exports = {
  optimizeSequence,
};
