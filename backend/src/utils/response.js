function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function createdResponse(res, data, message = 'Created') {
  return successResponse(res, data, message, 201);
}

module.exports = {
  successResponse,
  createdResponse
};
