const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');

const app = require('../src/app');
const { toVisitStatus } = require('../src/modules/shared/presenters');

test('waiting-result task is not presented as completed by a closed queue entry', () => {
  assert.equal(toVisitStatus('WAITING_RESULT', 'DONE'), 'WAITING_RESULT');
});

test('doctor call and result-validation routes are registered before auth handling', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/doctor/visits/VIS-WORKFLOW-CHECK`;
  const responses = await Promise.all([
    globalThis.fetch(`${baseUrl}/call`, { method: 'POST' }),
    globalThis.fetch(`${baseUrl}/results/validate`, { method: 'POST' }),
  ]);

  for (const response of responses) {
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  }
});
