const asyncHandler = require('../../utils/async-handler');
const { successResponse } = require('../../utils/response');

const getHealth = asyncHandler(async (_req, res) => {
  return successResponse(res, {
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  getHealth
};
