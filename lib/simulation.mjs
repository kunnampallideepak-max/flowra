import { formatElapsedTime } from './elapsed-time.mjs';
import { detectReadings } from './detection.mjs';
export const ZONES = [{
  id: 'A',
  name: 'North residential',
  households: 20,
  base: 24
}, {
  id: 'B',
  name: 'Community center',
  households: 18,
  base: 21.6
}, {
  id: 'C',
  name: 'South residential',
  households: 12,
  base: 14.4
}];
export const SCENARIOS = {
  normal: 'Normal operation',
  leak: 'Suspected leak',
  spike: 'Demand spike',
  low: 'Limited supply'
};
export const CAPACITY = 20000;
export const RESERVE = 2000;
export const STEP = 1; // One simulated minute per two wall-clock seconds.
const sum = a => a.reduce((x, y) => x + y, 0);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function createSimulation(scenario = 'normal') {
  if (!SCENARIOS[scenario]) throw new Error('Unknown scenario');
  return advance({
    scenario,
    minute: -1,
    tank: scenario === 'low' ? 3200 : 15600,
    valves: [100, 100, 100],
    history: [],
    streaks: [0, 0, 0],
    events: [],
    alerts: []
  });
}
export function advance(state, valves = state.valves) {
  const minute = state.minute + STEP;
  const source = state.scenario === 'low' ? 15 : 68;
  const demands = ZONES.map((z, i) => z.base * (1 + 0.045 * Math.sin(minute / 6 + i)) * (state.scenario === 'spike' && i === 2 ? 2.2 : 1));
  const requested = demands.map((v, i) => v * clamp(valves[i], 0, 100) / 100 + (state.scenario === 'leak' && i === 1 ? 12 * valves[i] / 100 : 0));
  const ratio = Math.min(1, (state.tank + source * STEP) / Math.max(0.001, sum(requested) * STEP));
  const zones = ZONES.map((z, i) => {
    const inflow = requested[i] * ratio;
    const loss = state.scenario === 'leak' && i === 1 ? 12 * valves[i] / 100 * ratio : 0;
    const outflow = inflow - loss;
    return {
      ...z,
      demand: demands[i],
      inflow,
      outflow,
      loss,
      valve: valves[i],
      unmet: Math.max(0, demands[i] - outflow)
    };
  });
  const total = sum(zones.map(z => z.inflow));
  const rawTank = state.tank + (source - total) * STEP;
  const tank = clamp(rawTank, 0, CAPACITY);
  const { streaks, alerts } = detectReadings(zones, tank, state.streaks, CAPACITY);
  const events = [...state.events];
  alerts.forEach(a => {
    if (!state.alerts.some(old => old.id === a.id)) events.push({
      ...a,
      minute,
      status: 'Opened'
    });
  });
  state.alerts.forEach(a => {
    if (!alerts.some(next => next.id === a.id)) events.push({
      ...a,
      minute,
      status: 'Resolved'
    });
  });
  const sample = {
    minute,
    tank,
    level: tank / CAPACITY * 100,
    source,
    total,
    consumption: sum(zones.map(z => z.outflow)),
    loss: sum(zones.map(z => z.loss)),
    demand: sum(demands)
  };
  return {
    ...state,
    ...sample,
    zones,
    valves: [...valves],
    streaks,
    alerts,
    events: events.slice(-100),
    overflow: Math.max(0, rawTank - CAPACITY),
    history: [...state.history, sample].slice(-90)
  };
}
export function forecast(state, horizon = 120) {
  const recent = state.history.slice(-10);
  const demand = sum(recent.map(x => x.demand)) / recent.length;
  const loss = sum(recent.map(x => x.loss)) / recent.length;
  const available = Math.max(0, state.tank - RESERVE) + state.source * horizon;
  const required = (demand + loss) * horizon;
  const net = demand + loss - state.source;
  return {
    horizon,
    demand,
    loss,
    available,
    required,
    shortage: Math.max(0, required - available),
    reserveMinutes: net > 0 ? Math.max(0, state.tank - RESERVE) / net : null
  };
}
export function allocate(state, valves = state.valves, horizon = 120) {
  const f = forecast(state, horizon);
  const needs = state.zones.map(z => z.demand * horizon);
  const fullLoss = state.zones.map(z => z.valve > 0 ? z.loss * 100 / z.valve : state.scenario === 'leak' && z.id === 'B' ? 12 : 0);
  const ratio = Math.min(1, f.available / Math.max(1, sum(needs) + sum(fullLoss) * horizon));
  const proposed = needs.map(n => n * ratio);
  // Current virtual valve shares compete for the same finite budget.
  const requested = needs.map((n, i) => n * valves[i] / 100);
  const losses = fullLoss.map((loss, i) => loss * horizon * valves[i] / 100);
  const scale = Math.min(1, f.available / Math.max(1, sum(requested) + sum(losses)));
  const current = requested.map(n => n * scale);
  return {
    ...f,
    needs,
    current,
    proposed,
    proposedLoss: sum(fullLoss) * horizon * ratio,
    currentLoss: sum(losses) * scale,
    proposedValves: needs.map(() => Math.floor(ratio * 100)),
    unmet: sum(needs) - sum(current),
    proposedUnmet: sum(needs) - sum(proposed),
    fairness: Math.min(...current.map((v, i) => v / needs[i])) * 100,
    proposedFairness: ratio * 100
  };
}
export function explain(state) {
  const f = forecast(state);
  return `At T+${formatElapsedTime(state.minute)}, the tank holds ${state.tank.toFixed(0)} L (${state.level.toFixed(1)}%). Source flow is ${state.source.toFixed(1)} L/min; distribution is ${state.total.toFixed(1)} L/min. ${state.alerts.length ? state.alerts.map(a => `${a.title}: ${a.reason} ${a.advice}`).join(' ') : 'No detection thresholds are currently exceeded.'} The 120-minute forecast estimates ${f.shortage.toFixed(0)} L of shortfall above a 2,000 L reserve. This is a constant-demand estimate from up to ten recent samples, not a guarantee. All readings are synthetic; suspected leaks are not confirmed.`;
}
