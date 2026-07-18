const AppError = require('../errors/app-error');
const { verifyAccessToken } = require('../modules/auth/token');

function authenticate(req, _res, next) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Missing bearer token', 401, 'UNAUTHORIZED'));
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return next(new AppError('Invalid or expired token', 401, 'UNAUTHORIZED'));
  }

  req.auth = payload;
  return next();
}

module.exports = {
  authenticate,
};
