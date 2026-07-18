const { z } = require('zod');

const idParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  })
});

module.exports = {
  idParamSchema
};
