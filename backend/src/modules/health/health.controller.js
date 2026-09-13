const asyncHandler = require('../../utils/async-handler');
const { successResponse } = require('../../utils/response');

const getHealth = asyncHandler(async (_req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'medflow-backend',
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  getHealth
};
