// Test-owned expectations; never import response values from the implementation under test.
export const HTTP_STATUS = {
  ok: 200,
  noContent: 204,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  methodNotAllowed: 405,
  payloadTooLarge: 413,
  rateLimited: 429,
  serverError: 500,
  badGateway: 502,
  unavailable: 503,
} as const

export const HTTP_METHOD = {
  get: 'GET',
  options: 'OPTIONS',
  post: 'POST',
} as const

export const HTTP_HEADER = {
  allowMethods: 'Access-Control-Allow-Methods',
  allowOrigin: 'access-control-allow-origin',
  allowHeaders: 'access-control-allow-headers',
  contentType: 'Content-Type',
} as const

export const HTTP_CONTENT_TYPE = {
  json: 'application/json',
  javascript: 'text/javascript',
} as const

export const HTTP_ALLOWED_METHODS = 'POST, OPTIONS'
export const HTTP_CORS_ORIGIN_ANY = '*'
