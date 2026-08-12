export function apiTimeoutMs(value: string | undefined) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 120_000
}

export function shouldUseMockApi(value: string | undefined, isProduction: boolean) {
  return !isProduction && value !== 'false'
}

export function apiBaseUrl(value: string | undefined) {
  const configured = value?.trim() || 'http://localhost:3000/api/v1'
  const withProtocol = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`
  const url = new URL(withProtocol)
  if (!url.pathname || url.pathname === '/') url.pathname = '/api/v1'
  return url.toString().replace(/\/$/, '')
}
