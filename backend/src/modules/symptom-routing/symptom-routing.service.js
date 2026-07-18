const AppError = require('../../errors/app-error');
const envConfig = require('../../config/env');

const SYMPTOM_ROUTING_PATH = '/api/v1/symptom-routing';
const REQUEST_TIMEOUT_MS = 15000;

function buildAiUrl() {
  const baseUrl = envConfig.aiServiceUrl;
  if (!baseUrl) {
    throw new AppError('AI_SERVICE_URL is not configured', 503, 'AI_SERVICE_URL_MISSING');
  }

  return new globalThis.URL(SYMPTOM_ROUTING_PATH, baseUrl).toString();
}

async function routeSymptoms(payload) {
  const controller = new globalThis.AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await globalThis.fetch(buildAiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { detail: await response.text() };

    return {
      statusCode: response.status,
      data
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError('AI service request timed out', 504, 'AI_SERVICE_TIMEOUT');
    }

    throw new AppError(
      `Unable to reach AI symptom routing service: ${error.message}`,
      502,
      'AI_SERVICE_UNAVAILABLE'
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

module.exports = {
  routeSymptoms
};
