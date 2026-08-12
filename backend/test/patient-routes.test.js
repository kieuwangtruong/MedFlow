const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');

const app = require('../src/app');

test('patient routing endpoint is registered before the not-found handler', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  const response = await globalThis.fetch(`http://127.0.0.1:${address.port}/api/v1/visits/VIS-ROUTE-CHECK/routing`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'UNAUTHORIZED');
});
