// Read-only official metadata; no generation, credentials or raw errors are printed.
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const key = process.env.GEMINI_API_KEY?.trim();
if (!key) { console.log('Server key is not configured.'); process.exitCode = 1; }
else {
  const safeModel = model => ({ name: /^models\/gemini-[a-zA-Z0-9._-]+$/.test(model?.name) ? model.name : 'UNRECOGNIZED_NAME', version: /^[a-zA-Z0-9._-]{1,100}$/.test(model?.version) ? model.version : null, displayName: /^Gemini [a-zA-Z0-9 .()_-]{1,120}$/.test(model?.displayName) ? model.displayName : null, supportsGenerateContent: model?.supportedGenerationMethods?.includes('generateContent') === true });
  for (const path of ['models/gemini-flash-latest', 'models?pageSize=100']) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${path}`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(10000) });
      const body = await response.json();
      console.log(JSON.stringify({ check: path.startsWith('models?') ? 'available-models' : 'alias-resolution', httpStatus: response.status, ...(response.ok ? (body.models ? { models: body.models.filter(model => model.supportedGenerationMethods?.includes('generateContent') && model.name?.startsWith('models/gemini-')).map(safeModel), morePages: Boolean(body.nextPageToken) } : { model: safeModel(body) }) : {}) }));
      if (!response.ok) process.exitCode = 1;
    } catch { console.log(JSON.stringify({ check: 'metadata', failed: true })); process.exitCode = 1; break; }
  }
}
