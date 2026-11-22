// Only fixed codes and messages leave this module. Never return raw provider errors.
const errors = {
  NOT_CONFIGURED: [503, 'AI explanation unavailable. Configure GEMINI_API_KEY in .env.local and restart the server.'],
  INVALID_MODEL_CONFIG: [503, 'AI explanation unavailable: invalid GEMINI_MODEL configuration. Use a Gemini model ID, not a URL.'],
  INVALID_API_KEY: [502, 'AI explanation unavailable: Gemini rejected the API key. Check or replace the server-side GEMINI_API_KEY and restart Next.js.'],
  PERMISSION_DENIED: [502, 'AI explanation unavailable: Gemini denied access. Check API-key restrictions, API enablement, project permissions and billing.'],
  MODEL_NOT_FOUND: [502, 'AI explanation unavailable: the configured Gemini model was not found or is not available to this project. Check GEMINI_MODEL.'],
  QUOTA_EXCEEDED: [429, 'AI explanation unavailable: Gemini quota or rate limit exceeded. Check project quota and billing; wait before retrying.'],
  BILLING_REQUIRED: [502, 'AI explanation unavailable: Gemini requires billing or available project credits. Check the Google project billing settings.'],
  REQUEST_REJECTED: [502, 'AI explanation unavailable: Gemini rejected the request format or project prerequisites. Check model compatibility and server configuration.'],
  PROVIDER_UNAVAILABLE: [503, 'AI explanation unavailable: the Gemini service is temporarily unavailable. Try again later.'],
  TIMEOUT: [504, 'AI explanation unavailable: Gemini did not finish before the server timeout. Retry later or configure GEMINI_TIMEOUT_MS (1000–120000 ms).'],
  NETWORK_ERROR: [502, 'AI explanation unavailable: the server could not reach Gemini. Check DNS, firewall, proxy and internet connectivity.'],
  TLS_ERROR: [502, 'AI explanation unavailable: the server could not verify the Gemini TLS connection. Check system certificates or your network proxy; do not disable TLS verification.'],
  CONTENT_BLOCKED: [502, 'AI explanation unavailable: Gemini blocked this request or response. Rephrase the question; the rules-based evidence remains available.'],
  OUTPUT_LIMIT: [502, 'AI explanation unavailable: Gemini reached its output limit before producing a usable answer. Try a shorter question or a different supported model.'],
  INVALID_RESPONSE: [502, 'AI explanation unavailable: Gemini returned an invalid or empty response. No generated answer is being displayed.']
};
export function failure(code) {
  const [httpStatus, message] = errors[code] || errors.INVALID_RESPONSE;
  return { available: false, errorCode: Object.hasOwn(errors, code) ? code : 'INVALID_RESPONSE', httpStatus, message };
}
export function providerFailure(status, body) {
  const reasons = body?.error?.details?.map?.(detail => detail?.reason) || [];
  // Some legacy key errors have no ErrorInfo. Inspect internally, never echo their text.
  if (status === 401 || reasons.some(reason => ['API_KEY_INVALID', 'API_KEY_EXPIRED'].includes(reason)) || (status === 400 && /api key (not valid|is invalid|expired)/i.test(body?.error?.message || ''))) return failure('INVALID_API_KEY');
  if (status === 403) return failure('PERMISSION_DENIED');
  if (status === 404) return failure('MODEL_NOT_FOUND');
  if (status === 429) return failure('QUOTA_EXCEEDED');
  if (status === 402) return failure('BILLING_REQUIRED');
  if (status >= 500) return failure('PROVIDER_UNAVAILABLE');
  return failure('REQUEST_REJECTED');
}
export function transportFailure(error) {
  if (['TimeoutError', 'AbortError'].includes(error?.name) || ['UND_ERR_CONNECT_TIMEOUT', 'ETIMEDOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'].includes(error?.cause?.code)) return failure('TIMEOUT');
  if (['CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(error?.cause?.code)) return failure('TLS_ERROR');
  return failure('NETWORK_ERROR');
}
export const timeoutSetting = value => /^\d+$/.test(String(value)) && Number(value) >= 1000 && Number(value) <= 120000 ? Number(value) : 60000;
