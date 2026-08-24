import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  apiBaseUrl,
  apiTimeoutMs,
  isTransientHttpStatus,
  safeApiErrorMessage,
  shouldUseMockApi,
} from '../src/api/apiConfig.ts'

test('API base URL defaults to the versioned local backend', () => {
  assert.equal(apiBaseUrl(undefined), 'http://localhost:3000/api/v1')
})

test('API base URL adds HTTPS and the versioned path for a bare host', () => {
  assert.equal(apiBaseUrl('backend.example.test'), 'https://backend.example.test/api/v1')
})

test('API timeout accepts only positive integers', () => {
  assert.equal(apiTimeoutMs('45000'), 45_000)
  assert.equal(apiTimeoutMs('0'), 120_000)
  assert.equal(apiTimeoutMs('not-a-number'), 120_000)
})

test('production can never enable mock API mode', () => {
  assert.equal(shouldUseMockApi(undefined, true), false)
  assert.equal(shouldUseMockApi('true', true), false)
  assert.equal(shouldUseMockApi(undefined, false), true)
  assert.equal(shouldUseMockApi('false', false), false)
})

test('warmup retries only temporary gateway and availability failures', () => {
  assert.equal(isTransientHttpStatus(undefined), true)
  assert.equal(isTransientHttpStatus(502), true)
  assert.equal(isTransientHttpStatus(503), true)
  assert.equal(isTransientHttpStatus(401), false)
  assert.equal(isTransientHttpStatus(422), false)
})

test('API error messages never expose an upstream HTML error page', () => {
  const html502 = '<!DOCTYPE html><html><head><title>502</title><style>body {}</style></head></html>'
  assert.equal(safeApiErrorMessage(html502, 'Không thể phân tích triệu chứng'), 'Không thể phân tích triệu chứng')
  assert.equal(safeApiErrorMessage('Lượt khám không tồn tại', 'Lỗi'), 'Lượt khám không tồn tại')
})
