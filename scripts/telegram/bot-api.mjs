const WEBHOOK_REJECTION_REASONS = Object.freeze([
  { pattern: /failed to resolve host|dns/i, code: 'HOST_RESOLUTION' },
  {
    pattern: /failed to connect|connection refused|connect timeout/i,
    code: 'CONNECTION',
  },
  { pattern: /ssl|tls|certificate/i, code: 'TLS' },
  { pattern: /wrong response|http error/i, code: 'HTTP_RESPONSE' },
  {
    pattern: /invalid url|bad url|unsupported port|invalid port/i,
    code: 'INVALID_URL',
  },
  { pattern: /secret.token/i, code: 'INVALID_SECRET' },
])
export class TelegramBotConfigurationError extends Error {
  operation
  code
  providerStatus
  providerErrorCode
  providerReason

  constructor(
    operation,
    code,
    providerStatus = null,
    providerErrorCode = null,
    providerReason = null,
  ) {
    super(`Telegram bot configuration operation ${operation} failed.`)
    this.name = 'TelegramBotConfigurationError'
    this.operation = operation
    this.code = code
    this.providerStatus = providerStatus
    this.providerErrorCode = providerErrorCode
    this.providerReason = providerReason
  }
}

function classifyWebhookRejection(operation, description) {
  if (operation !== 'setWebhook' || typeof description !== 'string') {
    return null
  }
  return (
    WEBHOOK_REJECTION_REASONS.find(({ pattern }) => pattern.test(description))
      ?.code ?? 'OTHER'
  )
}

export function sanitizeWebhookInfo(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    url: typeof source.url === 'string' ? source.url : '',
    pendingUpdateCount:
      Number.isSafeInteger(source.pending_update_count) &&
      source.pending_update_count >= 0
        ? source.pending_update_count
        : 0,
    allowedUpdates: Array.isArray(source.allowed_updates)
      ? source.allowed_updates.filter((item) => typeof item === 'string')
      : [],
    hasLastError:
      Number.isSafeInteger(source.last_error_date) ||
      typeof source.last_error_message === 'string',
  }
}

export function createTelegramBotApi({
  token,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}) {
  const call = async (operation, payload = {}) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      let response
      try {
        response = await fetchImpl(
          `https://api.telegram.org/bot${token}/${operation}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        )
      } catch (error) {
        const code =
          controller.signal.aborted || error?.name === 'AbortError'
            ? 'TELEGRAM_API_TIMEOUT'
            : 'TELEGRAM_API_NETWORK_ERROR'
        throw new TelegramBotConfigurationError(operation, code)
      }

      let body
      try {
        body = await response.json()
      } catch {
        throw new TelegramBotConfigurationError(
          operation,
          'TELEGRAM_API_INVALID_RESPONSE',
          response.status,
        )
      }

      if (!response.ok || body?.ok !== true) {
        throw new TelegramBotConfigurationError(
          operation,
          'TELEGRAM_API_REJECTED',
          response.status,
          Number.isSafeInteger(body?.error_code) ? body.error_code : null,
          classifyWebhookRejection(operation, body?.description),
        )
      }

      return body.result
    } finally {
      clearTimeout(timeout)
    }
  }

  return { call }
}
