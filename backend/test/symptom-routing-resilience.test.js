const assert = require('node:assert/strict');
const { test } = require('node:test');

const AppError = require('../src/errors/app-error');
const { requestAi } = require('../src/modules/ai-gateway/ai-client');
const {
  fallbackRouting,
  routeSymptoms,
} = require('../src/modules/symptom-routing/symptom-routing.service');

test('AI client retries a temporary HTML 502 response', async (t) => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return new globalThis.Response('<!DOCTYPE html><html><title>502</title></html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      });
    }
    return new globalThis.Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await requestAi('/health', { retryDelaysMs: [0], timeoutMs: 1_000 });

  assert.deepEqual(result, { status: 'ok' });
  assert.equal(requestCount, 2);
});

test('AI client never exposes an upstream HTML error page', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new globalThis.Response(
    '<!DOCTYPE html><html><head><title>502</title></head></html>',
    { status: 502, headers: { 'content-type': 'text/html' } },
  );
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    requestAi('/health', { retryDelaysMs: [], timeoutMs: 1_000 }),
    (error) => error instanceof AppError
      && error.statusCode === 502
      && !error.message.toLowerCase().includes('doctype'),
  );
});

test('fallback sends unilateral numbness to the emergency room', () => {
  const result = fallbackRouting({ symptom_text: 'Tê nửa người, váng đầu' });

  assert.equal(result.is_red_flag, true);
  assert.equal(result.priority, 'EMERGENCY');
  assert.equal(result.recommendations[0].department_code, 'ER');
  assert.equal(result.recommendations[0].clinic_room, 'CC-102');
  assert.equal(result.requires_human_review, true);
});

test('fallback uses general intake with human review for non-emergency symptoms', () => {
  const result = fallbackRouting({ symptom_text: 'Ho nhẹ từ hôm qua' });

  assert.equal(result.is_red_flag, false);
  assert.equal(result.recommendations[0].department_code, 'GENERAL');
  assert.equal(result.recommendations[0].clinic_room, 'PK-TQ-101');
  assert.equal(result.requires_human_review, true);
});

test('symptom routing falls back only when AI is unavailable', async () => {
  const unavailableAi = async () => {
    throw new AppError('temporary outage', 503, 'AI_SERVICE_ERROR');
  };

  const result = await routeSymptoms(
    { symptom_text: 'Tê nửa người, váng đầu' },
    unavailableAi,
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.source, 'BACKEND_SAFETY_FALLBACK');
  assert.equal(result.data.priority, 'EMERGENCY');
});

test('symptom routing preserves client and validation errors', async () => {
  const invalidRequest = async () => {
    throw new AppError('invalid symptoms', 422, 'AI_SERVICE_ERROR');
  };

  await assert.rejects(
    routeSymptoms({ symptom_text: '' }, invalidRequest),
    (error) => error instanceof AppError && error.statusCode === 422,
  );
});
