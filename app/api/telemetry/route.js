import { boundedJson, InputError } from '../../../lib/http-input.mjs';
import { validIngestToken } from '../../../lib/ingest-auth.mjs';
import { latestTelemetry, receiveTelemetry } from '../../../lib/telemetry-store.mjs';
import { TelemetryError, SOURCE_LABEL } from '../../../lib/telemetry.mjs';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET() {
  return json({ ...latestTelemetry(), configured: Boolean(process.env.FLOWRA_INGEST_TOKEN?.trim().length >= 32), sourceLabel: SOURCE_LABEL });
}
export async function POST(request) {
  if (!process.env.FLOWRA_INGEST_TOKEN || process.env.FLOWRA_INGEST_TOKEN.trim().length < 32) return json({ message: 'Telemetry ingestion is disabled. Configure a separate FLOWRA_INGEST_TOKEN of at least 32 characters on the server.' }, 503);
  if (!validIngestToken(request.headers.get('authorization'), process.env.FLOWRA_INGEST_TOKEN)) return json({ message: 'Device authentication failed.' }, 401);
  try {
    const state = receiveTelemetry(await boundedJson(request), { deviceId: process.env.FLOWRA_DEVICE_ID || 'esp32-flowra-01' });
    return json({ accepted: true, receivedAt: state.receivedAt, sequence: state.sequence, sourceLabel: state.sourceLabel }, 202);
  } catch (error) {
    if (error instanceof InputError || error instanceof TelemetryError) return json({ message: error.message }, error.status);
    return json({ message: 'Telemetry frame could not be accepted.' }, 500);
  }
}
