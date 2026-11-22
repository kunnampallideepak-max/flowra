import { LOCATIONS, LOCATION_SOURCES } from '../../../lib/networks.mjs';
export function GET() {
  return Response.json({ states: LOCATIONS, sources: LOCATION_SOURCES, reviewedAt: '2026-11-21', coverage: 'Curated pilot only. Place names are context, not water infrastructure records.' }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
}
