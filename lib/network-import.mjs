// Local review only. A provenance declaration is not independent verification.
const fail = () => { throw new Error('Network JSON is invalid. Use the documented schema with a connected directed tree and provenance.'); };
const object = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const text = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit && !/[\u0000-\u001f<>]/.test(value);
export function validateNetworkImport(value) {
  if (!object(value, ['schemaVersion', 'name', 'provenance', 'nodes', 'edges', 'sensors']) || value.schemaVersion !== 1 || !text(value.name, 100)) fail();
  const p = value.provenance;
  if (!object(p, ['publisher', 'sourceUrl', 'permission', 'licenseReference']) || !text(p.publisher, 120) || !text(p.licenseReference, 300) || !['public-license', 'owner-authorized'].includes(p.permission)) fail();
  let url; try { url = new URL(p.sourceUrl); } catch { fail(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.href.length > 300) fail();
  if (!Array.isArray(value.nodes) || value.nodes.length < 3 || value.nodes.length > 32 || !Array.isArray(value.edges) || value.edges.length !== value.nodes.length - 1 || !Array.isArray(value.sensors) || value.sensors.length > 64) fail();
  const ids = new Set(); const kinds = ['source', 'reservoir', 'junction', 'valve', 'zone'];
  const id = item => typeof item === 'string' && /^[a-zA-Z0-9-]{1,40}$/.test(item);
  for (const node of value.nodes) { if (!object(node, ['id', 'kind']) || !id(node.id) || ids.has(node.id) || !kinds.includes(node.kind)) fail(); ids.add(node.id); }
  const source = value.nodes.filter(node => node.kind === 'source');
  if (source.length !== 1 || value.nodes.filter(node => node.kind === 'reservoir').length !== 1 || !value.nodes.some(node => node.kind === 'zone')) fail();
  const incoming = new Map(), children = new Map();
  for (const edge of value.edges) {
    if (!object(edge, ['from', 'to']) || !ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to || incoming.has(edge.to)) fail();
    incoming.set(edge.to, edge.from); children.set(edge.from, [...(children.get(edge.from) || []), edge.to]);
  }
  if (incoming.has(source[0].id)) fail();
  const seen = new Set(), queue = [source[0].id];
  while (queue.length) { const current = queue.shift(); if (seen.has(current)) fail(); seen.add(current); queue.push(...(children.get(current) || [])); }
  if (seen.size !== ids.size || value.nodes.some(node => node.kind === 'zone' && children.has(node.id))) fail();
  const reservoir = value.nodes.find(node => node.kind === 'reservoir').id;
  for (const zone of value.nodes.filter(node => node.kind === 'zone')) { let parent = incoming.get(zone.id), stored = false; while (parent) { if (parent === reservoir) stored = true; parent = incoming.get(parent); } if (!stored) fail(); }
  const sensorIds = new Set();
  for (const sensor of value.sensors) {
    if (!object(sensor, ['id', 'nodeId', 'kind']) || !id(sensor.id) || sensorIds.has(sensor.id) || !ids.has(sensor.nodeId) || !['flow', 'level'].includes(sensor.kind)) fail();
    if (sensor.kind === 'level' && value.nodes.find(node => node.id === sensor.nodeId).kind !== 'reservoir') fail();
    sensorIds.add(sensor.id);
  }
  return structuredClone(value);
}
