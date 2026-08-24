const AppError = require('../../errors/app-error');
const envConfig = require('../../config/env');

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_RETRY_DELAYS_MS = [1_500, 3_000, 5_000, 8_000, 12_000, 15_000];
const HTML_RESPONSE_PATTERN = /<!doctype\s+html|<html[\s>]|<head[\s>]|<style[\s>]/i;

function serviceBaseUrl(value) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function delay(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function safeDetail(detail) {
  if (typeof detail !== 'string') return null;
  const message = detail.trim();
  if (!message || message.length > 500 || HTML_RESPONSE_PATTERN.test(message)) return null;
  return message;
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    return { data: null, isJson: false };
  }

  try {
    return { data: text ? JSON.parse(text) : null, isJson: true };
  } catch {
    return { data: null, isJson: false };
  }
}

function normalizeRequestError(error) {
  if (error instanceof AppError) return error;
  if (error?.name === 'AbortError') {
    return new AppError(
      'Dịch vụ phân tích tạm thời chưa phản hồi. Vui lòng thử lại.',
      504,
      'AI_SERVICE_TIMEOUT',
    );
  }
  return new AppError(
    'Dịch vụ phân tích tạm thời chưa sẵn sàng. Vui lòng thử lại.',
    502,
    'AI_SERVICE_UNAVAILABLE',
  );
}

function isTransientError(error) {
  return error instanceof AppError && TRANSIENT_HTTP_STATUSES.has(error.statusCode);
}

async function requestAi(path, options = {}) {
  const timeoutMs = options.timeoutMs || envConfig.aiRequestTimeoutMs;
  const retryDelaysMs = Array.isArray(options.retryDelaysMs)
    ? options.retryDelaysMs
    : DEFAULT_RETRY_DELAYS_MS;
  const startedAt = Date.now();
  const url = new globalThis.URL(path, serviceBaseUrl(envConfig.aiServiceUrl)).toString();

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      throw normalizeRequestError({ name: 'AbortError' });
    }

    const controller = new globalThis.AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), remainingMs);
    let requestError;

    try {
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
      const { data, isJson } = await parseResponse(response);

      if (!response.ok) {
        const message = safeDetail(data?.detail)
          || 'Dịch vụ phân tích tạm thời chưa sẵn sàng. Vui lòng thử lại.';
        requestError = new AppError(message, response.status, 'AI_SERVICE_ERROR', isJson ? data : null);
      } else if (!isJson) {
        requestError = new AppError(
          'Dịch vụ phân tích trả về dữ liệu không hợp lệ. Vui lòng thử lại.',
          502,
          'AI_SERVICE_INVALID_RESPONSE',
        );
      } else {
        return data;
      }
    } catch (error) {
      requestError = normalizeRequestError(error);
    } finally {
      globalThis.clearTimeout(timeout);
    }

    if (!isTransientError(requestError) || attempt === retryDelaysMs.length) {
      throw requestError;
    }

    const retryDelayMs = Math.max(0, Number(retryDelaysMs[attempt]) || 0);
    const retryBudgetMs = timeoutMs - (Date.now() - startedAt);
    if (retryDelayMs >= retryBudgetMs) {
      throw normalizeRequestError({ name: 'AbortError' });
    }
    await delay(retryDelayMs);
  }

  throw new AppError(
    'Dịch vụ phân tích tạm thời chưa sẵn sàng. Vui lòng thử lại.',
    502,
    'AI_SERVICE_UNAVAILABLE',
  );
}

module.exports = { requestAi };
