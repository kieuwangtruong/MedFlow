const AppError = require('../../errors/app-error');
const envConfig = require('../../config/env');

function serviceBaseUrl(value) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

async function requestAi(path, options = {}) {
  const controller = new globalThis.AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs || envConfig.aiRequestTimeoutMs,
  );

  try {
    const url = new globalThis.URL(path, serviceBaseUrl(envConfig.aiServiceUrl)).toString();
    const response = await globalThis.fetch(url, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(envConfig.aiServiceApiKey ? { 'X-API-Key': envConfig.aiServiceApiKey } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { detail: await response.text() };

    if (!response.ok) {
      const message = typeof data.detail === 'string'
        ? data.detail
        : `AI service returned HTTP ${response.status}`;
      throw new AppError(message, response.status, 'AI_SERVICE_ERROR', data);
    }

    return data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.name === 'AbortError') {
      throw new AppError('AI service request timed out', 504, 'AI_SERVICE_TIMEOUT');
    }
    throw new AppError(`Unable to reach AI service: ${error.message}`, 502, 'AI_SERVICE_UNAVAILABLE');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

module.exports = { requestAi };
