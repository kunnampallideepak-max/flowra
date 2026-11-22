import { generateExplanation, readConversation, readSnapshot } from '../../../lib/explanation.mjs';
import { timeoutSetting } from '../../../lib/gemini-diagnostics.mjs';
import { TelemetryError } from '../../../lib/telemetry.mjs';
import { boundedJson, InputError, isSameOriginRequest } from '../../../lib/http-input.mjs';
export const maxDuration = 90;
const recent = [];
const json = (data, status = 200) => Response.json(data, {
  status,
  headers: {
    'Cache-Control': 'no-store'
  }
});
export async function POST(request) {
  if (!isSameOriginRequest(request, process.env.FLOWRA_PUBLIC_ORIGIN)) return json({
    message: 'Cross-origin requests are not accepted.'
  }, 403);
  try {
    const input = await boundedJson(request, 40000);
    const state = readSnapshot(input);
    const conversation = readConversation(input, state);
    const now = Date.now();
    while (recent.length && recent[0] < now - 60000) recent.shift();
    if (recent.length >= 10) return json({
      available: false,
      message: 'AI explanation unavailable: server request limit reached. Retry in a minute.',
      explanation: (await generateExplanation(state)).explanation
    }, 429);
    recent.push(now);
    const result = await generateExplanation(state, {
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
      conversation,
      timeoutMs: timeoutSetting(process.env.GEMINI_TIMEOUT_MS)
    });
    return json(result, result.available ? 200 : result.httpStatus);
  } catch (error) {
    if (error instanceof InputError) return json({ available: false, message: error.message }, error.status);
    if (error instanceof TelemetryError) return json({ available: false, message: error.message }, 400);
    return json({
      available: false,
      message: 'Invalid simulation snapshot. Refresh the page and retry.'
    }, 400);
  }
}
