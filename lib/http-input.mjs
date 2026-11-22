export class InputError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

export function isSameOriginRequest(request, publicOrigin = '') {
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site' || site === 'same-site') return false;
  const origin = request.headers.get('origin');
  if (origin === null) return true; // Non-browser clients still need valid JSON and a valid snapshot.

  try {
    const source = new URL(origin);
    if (!['http:', 'https:'].includes(source.protocol) || source.origin !== origin) return false;
    const host = request.headers.get('host')?.toLowerCase();
    const defaultPort = source.protocol === 'https:' ? '443' : '80';
    if (host !== source.host && (source.port || host !== source.host + ':' + defaultPort)) return false;
    if (publicOrigin) return origin === publicOrigin.trim().replace(/\/$/, '');

    const target = new URL(request.url);
    if (origin === target.origin) return true;
    // NextURL canonicalizes literal loopback IPs to localhost. The original
    // Host above must still match the browser's exact authority.
    return target.hostname === 'localhost' && ['127.0.0.1', '[::1]'].includes(source.hostname) &&
      source.protocol === target.protocol && source.port === target.port;
  } catch {
    return false;
  }
}

export async function boundedJson(request, limit = 8192) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new InputError('Content-Type must be application/json.', 415);
  if (Number(request.headers.get('content-length')) > limit) throw new InputError('Request body is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError('JSON body is required.');
  const decoder = new TextDecoder(); let bytes = 0, text = '';
  while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > limit) { await reader.cancel(); throw new InputError('Request body is too large.', 413); } text += decoder.decode(value, { stream: true }); }
  try { return JSON.parse(text + decoder.decode()); } catch { throw new InputError('Invalid JSON body.'); }
}
