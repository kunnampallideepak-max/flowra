// Server-only diagnostic. Never print environment values, raw errors, prompts or responses.
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const key = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
console.log(JSON.stringify({ keyPresent: Boolean(key), model: /^gemini-[a-z0-9.-]{1,90}$/.test(model) ? model : 'INVALID_MODEL_CONFIGURATION', node: process.version }));
if (!key || !/^[a-zA-Z0-9._-]{1,100}$/.test(model)) process.exitCode = 1;
else {
  const started = Date.now();
  try {
    if (process.argv.includes('--generate')) {
      const { generateExplanation } = await import('../lib/explanation.mjs');
      const { createSimulation } = await import('../lib/simulation.mjs');
      const { timeoutSetting } = await import('../lib/gemini-diagnostics.mjs');
      const result = await generateExplanation(createSimulation(), {
        key, model, timeoutMs: timeoutSetting(process.env.GEMINI_TIMEOUT_MS), conversation: { question: 'How much water is stored? Answer in one short sentence with litres.', history: [] },
        fetcher: async (url, options) => {
          try {
            const response = await fetch(url, options);
            console.log(JSON.stringify({ check: 'generation-http', httpStatus: response.status, elapsedMs: Date.now() - started }));
            return response;
          } catch (error) {
            console.log(JSON.stringify({ check: 'generation-transport', timeout: error.name === 'TimeoutError', elapsedMs: Date.now() - started, connectTimeout: error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' }));
            throw error;
          }
        }
      });
      console.log(JSON.stringify({ check: 'generation-result', available: result.available, textPresent: Boolean(result.available && result.explanation?.trim()), errorCode: result.errorCode, elapsedMs: Date.now() - started }));
      if (!result.available) process.exitCode = 1;
    } else if (process.argv.includes('--check-post')) {
      // Deliberately invalid payload: checks POST reachability without generating tokens.
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [] }), signal: AbortSignal.timeout(10000) });
      console.log(JSON.stringify({ check: 'post-validation-no-generation', httpStatus: response.status, elapsedMs: Date.now() - started }));
      await response.body?.cancel();
    } else {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    console.log(JSON.stringify({ check: 'model-metadata', httpStatus: response.status, elapsedMs: Date.now() - started, supportsGenerateContent: Array.isArray(data.supportedGenerationMethods) ? data.supportedGenerationMethods.includes('generateContent') : null, providerStatus: ['INVALID_ARGUMENT', 'UNAUTHENTICATED', 'PERMISSION_DENIED', 'NOT_FOUND', 'RESOURCE_EXHAUSTED', 'UNAVAILABLE'].includes(data.error?.status) ? data.error.status : undefined }));
    }
  } catch (error) {
    const allowed = ['EACCES', 'EPERM', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'];
    console.log(JSON.stringify({ check: process.argv.includes('--check-post') ? 'post-validation-no-generation' : 'model-metadata', failed: true, elapsedMs: Date.now() - started, timeout: error.name === 'TimeoutError', networkCode: allowed.includes(error.cause?.code) ? error.cause.code : 'UNCLASSIFIED_NETWORK_ERROR' }));
    process.exitCode = 1;
  }
}
