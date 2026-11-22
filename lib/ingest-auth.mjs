import { createHash, timingSafeEqual } from 'node:crypto';
export function validIngestToken(header, configured) {
  if (typeof configured !== 'string' || configured.trim().length < 32 || configured.trim().length > 256 || typeof header !== 'string' || header.length > 300 || !header.startsWith('Bearer ')) return false;
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(configured.trim()));
}
