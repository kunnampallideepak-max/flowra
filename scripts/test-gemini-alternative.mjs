// Explicit one-shot test. No retries, billing operations, credential output or raw errors.
import nextEnv from '@next/env';
import { providerFailure, transportFailure } from '../lib/gemini-diagnostics.mjs';
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const model = 'gemini-3.5-flash-lite';
const key = process.env.GEMINI_API_KEY?.trim();
const started = Date.now();
if (!key) { console.log(JSON.stringify({ model, errorCode: 'NOT_CONFIGURED' })); process.exitCode = 1; }
else {
  try {
    // Exactly one generateContent call, no redirects and no retry middleware.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Simulated tank: 100 L. How much water is stored? Reply in five words or fewer.' }] }], generationConfig: { maxOutputTokens: 64 } })
    });
    const body = await response.json();
    if (!response.ok) {
      console.log(JSON.stringify({ model, httpStatus: response.status, errorCode: providerFailure(response.status, body).errorCode, elapsedMs: Date.now() - started })); process.exitCode = 1;
    } else {
      const text = body.candidates?.[0]?.content?.parts?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('').trim();
      console.log(JSON.stringify({ model, httpStatus: response.status, textGenerated: Boolean(text), finishReason: ['STOP', 'MAX_TOKENS', 'SAFETY'].includes(body.candidates?.[0]?.finishReason) ? body.candidates[0].finishReason : 'OTHER', modelVersion: /^gemini-[a-zA-Z0-9._-]+$/.test(body.modelVersion) ? body.modelVersion : null, elapsedMs: Date.now() - started }));
      if (!text) process.exitCode = 1;
    }
  } catch (error) { console.log(JSON.stringify({ model, errorCode: transportFailure(error).errorCode, elapsedMs: Date.now() - started })); process.exitCode = 1; }
}
