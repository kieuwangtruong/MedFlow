const AppError = require('../errors/app-error');

function notFoundHandler(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

function errorHandler(err, _req, res, _next) {
  const isValidationError = err.name === 'ZodError';
  const statusCode = isValidationError ? 400 : err.statusCode || err.status || 500;

  if (statusCode >= 500) {
    console.error(err);
  }

  let message = isValidationError ? 'Validation failed' : err.message || 'Internal Server Error';
  if (err.code === 'ECONNREFUSED' || (typeof err.code === 'string' && err.code.startsWith('P10'))) {
    message = 'Không thể kết nối cơ sở dữ liệu. Vui lòng kiểm tra lại dịch vụ máy chủ.';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message,
      ...(isValidationError ? { details: err.flatten() } : {})
    }
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
