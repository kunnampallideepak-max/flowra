// Flowra IDs are application IDs, NOT LGD/Census/utility identifiers.
export const LOCATION_SOURCES = {
  kerala: { title: 'Kerala State Election Commission · Ernakulam municipalities', url: 'https://www.sec.kerala.gov.in/public/ps/lb/da39a3ee5e6b4b0d3255bfef95601890afd8/U/M' },
  karnataka: { title: 'Mysuru district · Municipalities', url: 'https://mysore.nic.in/en/public-utility-category/municipality/' },
  maharashtra: { title: 'Pune district · Nagarpalika branch', url: 'https://pune.gov.in/en/nagarpalika-branch/' }
};
export const LOCATIONS = [
  { id: 'kerala', name: 'Kerala', districts: [{ id: 'ernakulam', name: 'Ernakulam', localities: [{ id: 'aluva', name: 'Aluva', template: 'residential' }, { id: 'angamaly', name: 'Angamaly', template: 'community' }] }] },
  { id: 'karnataka', name: 'Karnataka', districts: [{ id: 'mysuru', name: 'Mysuru', localities: [{ id: 'nanjangud', name: 'Nanjangud', template: 'community' }, { id: 'hunsur', name: 'Hunsur', template: 'residential' }] }] },
  { id: 'maharashtra', name: 'Maharashtra', districts: [{ id: 'pune', name: 'Pune', localities: [{ id: 'baramati', name: 'Baramati', template: 'community' }, { id: 'lonavala', name: 'Lonavala', template: 'standard' }] }] }
];
export const TEMPLATES = [
  { id: 'standard', name: 'Three-zone baseline', description: 'The original parallel distribution manifold. One tank supplies three independent zone branches.' },
  { id: 'residential', name: 'Residential fan', description: 'A compact radial layout with three direct branches below the reservoir.' },
  { id: 'community', name: 'Community trunk', description: 'A shared trunk splits into three terminal zone branches. Junctions have no storage or modeled pressure loss.' }
];
export const DEFAULT_NETWORK = { id: 'flowra-default', name: 'Flowra demonstration network', template: 'standard', type: 'illustrative', location: null, source: null };
export function resolveNetwork(stateId, districtId, localityId, templateId) {
  const state = LOCATIONS.find(item => item.id === stateId);
  const district = state?.districts.find(item => item.id === districtId);
  const locality = district?.localities.find(item => item.id === localityId);
  const template = TEMPLATES.find(item => item.id === templateId);
  if (!state || !district || !locality || !template) throw new Error('Choose a valid state, district, locality and network from the pilot directory.');
  return { id: `pilot:${state.id}:${district.id}:${locality.id}:${template.id}`, name: `${locality.name} / ${template.name}`, type: 'illustrative', template: template.id, location: { state: state.name, district: district.name, locality: locality.name }, source: LOCATION_SOURCES[state.id] };
}
export function networkById(id) {
  if (id === undefined || id === DEFAULT_NETWORK.id) return DEFAULT_NETWORK;
  if (typeof id !== 'string') throw new Error('Invalid network identity.');
  const [prefix, state, district, locality, template, extra] = id.split(':');
  if (prefix !== 'pilot' || extra !== undefined) throw new Error('Unknown network.');
  return resolveNetwork(state, district, locality, template);
}
export function validateLocationCatalog(data) {
  if (!data || !Array.isArray(data.states) || data.states.length !== LOCATIONS.length) throw new Error('The pilot directory is incomplete. Please retry.');
  // Explicitly reject altered or invalid administrative relationships.
  if (JSON.stringify(data.states) !== JSON.stringify(LOCATIONS)) throw new Error('The pilot directory did not match the validated local copy.');
  return data.states;
}
export const networkCaption = network => network.location ? `Illustrative network assigned to ${network.location.locality}` : 'Illustrative Flowra demonstration network';
export const hasDeviceMapping = network => network.id === DEFAULT_NETWORK.id;
