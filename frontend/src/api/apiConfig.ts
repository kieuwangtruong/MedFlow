export function apiTimeoutMs(value: string | undefined) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 120_000
}

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])
const HTML_ERROR_PATTERN = /<!doctype\s+html|<html[\s>]|<head[\s>]|<style[\s>]/i

export function isTransientHttpStatus(status: number | undefined) {
  return status === undefined || TRANSIENT_HTTP_STATUSES.has(status)
}

export function safeApiErrorMessage(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const message = value.trim()
  if (!message || message.length > 500 || HTML_ERROR_PATTERN.test(message)) return fallback
  return message
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
