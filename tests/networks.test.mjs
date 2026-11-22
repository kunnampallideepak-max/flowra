import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOCATIONS, TEMPLATES, resolveNetwork, networkById, DEFAULT_NETWORK, hasDeviceMapping, validateLocationCatalog } from '../lib/networks.mjs';
import { validateNetworkImport } from '../lib/network-import.mjs';
import { createSimulation } from '../lib/simulation.mjs';
import { snapshotKey, snapshotPayload } from '../lib/snapshot.mjs';
import { readSnapshot, readConversation, generateExplanation } from '../lib/explanation.mjs';
const example = JSON.parse(readFileSync(new URL('../docs/network-import.example.json', import.meta.url)));

test('curated administrative relationships resolve only within their official-source parents', () => {
  const ids = new Set();
  for (const state of LOCATIONS) for (const district of state.districts) for (const locality of district.localities) for (const template of TEMPLATES) {
    const network = resolveNetwork(state.id, district.id, locality.id, template.id);
    assert.deepEqual(networkById(network.id), network); assert.equal(network.type, 'illustrative'); assert.ok(!ids.has(network.id)); ids.add(network.id);
    assert.match(network.source.url, /^https:\/\//); assert.equal(hasDeviceMapping(network), false);
  }
  assert.equal(ids.size, 18); assert.equal(hasDeviceMapping(DEFAULT_NETWORK), true);
  for (const selection of [['kerala','pune','baramati','standard'], ['maharashtra','pune','aluva','standard'], ['karnataka','mysuru','hunsur','multi-tank'], ['invalid','none','none','standard']]) assert.throws(() => resolveNetwork(...selection));
  for (const id of ['pilot:kerala:pune:baramati:standard', 'flowra-default:secret', 'pilot:kerala:ernakulam:aluva:standard:extra']) assert.throws(() => networkById(id));
});
test('cached location validation rejects altered and incomplete hierarchy', () => {
  assert.deepEqual(validateLocationCatalog({ states: structuredClone(LOCATIONS) }), LOCATIONS);
  assert.throws(() => validateLocationCatalog({ states: [] }));
  const altered = structuredClone(LOCATIONS); altered[0].districts[0].localities[0].name = 'Invented place';
  assert.throws(() => validateLocationCatalog({ states: altered }));
});
test('network snapshot identities prevent cross-network conversational evidence mixing', () => {
  const id = resolveNetwork('kerala','ernakulam','aluva','residential').id;
  const original = createSimulation(), state = { ...original, networkId: id };
  const payload = snapshotPayload(state), rebuilt = readSnapshot(payload);
  assert.equal(rebuilt.networkId, id); assert.equal(rebuilt.total, original.total); assert.equal(rebuilt.tank, original.tank);
  assert.notEqual(snapshotKey(original), snapshotKey(state));
  assert.equal(snapshotKey(original), snapshotKey({ ...original, networkId: DEFAULT_NETWORK.id }));
  assert.throws(() => readSnapshot({ ...payload, networkId: 'pilot:unknown' }));
  assert.throws(() => readConversation({ question: 'Why?', conversation: [{ role: 'assistant', text: 'A previous network', snapshotKey: snapshotKey(original) }] }, rebuilt));
  assert.throws(() => readSnapshot({ sourceMode: 'connected', networkId: id, telemetrySnapshotId: 'unrelated' }));
});
test('Gemini receives truthful illustrative context through the preserved mocked transport', async () => {
  const state = readSnapshot(snapshotPayload({ ...createSimulation(), networkId: resolveNetwork('maharashtra','pune','baramati','community').id }));
  let request;
  const result = await generateExplanation(state, { key: 'mock-only', logger: () => {}, fetcher: async (_url, options) => { request = JSON.parse(options.body); return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'The synthetic tank contains water.' }] } }] }) }; } });
  assert.equal(result.available, true);
  const evidence = JSON.parse(request.contents[0].parts[0].text);
  assert.equal(evidence.networkContext, 'Illustrative network assigned to Baramati');
  assert.equal(evidence.zones[0].inflow, state.zones[0].inflow);
});
test('local import validates provenance declarations and a reservoir-fed tree without certifying it', () => {
  assert.deepEqual(validateNetworkImport(example), example);
  const variants = [value => { value.provenance.permission = 'unknown'; }, value => { value.provenance.sourceUrl = 'javascript:alert(1)'; }, value => { value.provenance.sourceUrl = 'https://example.org/?token=secret'; }, value => { value.nodes[1].id = 'source'; }, value => { value.edges[1].from = 'missing'; }, value => { value.edges[0].from = 'zone-a'; }, value => { value.sensors[0].nodeId = 'zone-a'; }, value => { value.apiKey = 'must-not-be-accepted'; }, value => { value.edges[2].from = 'source'; }];
  for (const mutate of variants) { const value = structuredClone(example); mutate(value); assert.throws(() => validateNetworkImport(value)); }
});
test('Flowra icon assets replace the default at both required ICO sizes', () => {
  const ico = readFileSync(new URL('../app/favicon.ico', import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 2); assert.equal(ico[6], 16); assert.equal(ico[22], 32);
  const svg = readFileSync(new URL('../app/icon.svg', import.meta.url), 'utf8'); assert.match(svg, /95e7c0/); assert.doesNotMatch(svg, /Next|Vercel/);
});
