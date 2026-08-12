const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const http = require('node:http');
const { once } = require('node:events');
const { test } = require('node:test');

const app = require('../src/app');
const { selectCandidateRooms } = require('../src/modules/ai-gateway/ai-gateway.controller');

function requestJson(port, path) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
      }));
    });
    request.on('error', reject);
  });
}

test('backend AI health gateway calls the wait-time liveness contract', async (t) => {
  const originalFetch = globalThis.fetch;
  let upstreamRequest;
  globalThis.fetch = async (url, options) => {
    upstreamRequest = { url: String(url), options };
    return new globalThis.Response(JSON.stringify({ status: 'ok', source: 'wait-time' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await requestJson(server.address().port, '/api/v1/ai/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok', source: 'wait-time' });
  assert.equal(upstreamRequest.url, 'http://localhost:8000/health/live');
  assert.equal(upstreamRequest.options.method, 'GET');
  assert.equal(upstreamRequest.options.headers.Accept, 'application/json');
});

test('room recommendations exclude the current examination room', () => {
  const rooms = [
    { id: 'ROOM-CURRENT', department: 'Imaging', status: 'OPEN' },
    { id: 'ROOM-ALTERNATIVE', department: 'Imaging', status: 'OPEN' },
    { id: 'ROOM-CLOSED', department: 'Imaging', status: 'CLOSED' },
  ];

  assert.deepEqual(
    selectCandidateRooms(rooms, 'Imaging', 'ROOM-CURRENT').map((room) => room.id),
    ['ROOM-ALTERNATIVE'],
  );
});

test('room recommendation fallback still excludes the current room', () => {
  const rooms = [
    { id: 'ROOM-CURRENT', department: 'Imaging', status: 'OPEN' },
    { id: 'ROOM-OTHER', department: 'Laboratory', status: 'OPEN' },
  ];

  assert.deepEqual(
    selectCandidateRooms(rooms, 'Missing department', 'ROOM-CURRENT').map((room) => room.id),
    ['ROOM-OTHER'],
  );
});
