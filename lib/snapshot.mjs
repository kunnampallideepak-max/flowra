// Shared numeric identity: no secrets or server configuration enter browser code.
export const snapshotKey = state => `${state.sourceMode || 'simulation'}:${state.telemetrySnapshotId || ''}:${state.scenario}:${state.minute}:${state.tank.toFixed(4)}:${state.valves.join(',')}${state.networkId && state.networkId !== 'flowra-default' ? `:${state.networkId}` : ''}`;
export function snapshotPayload(state) {
  return { ...(state.networkId && state.networkId !== 'flowra-default' ? { networkId: state.networkId } : {}), scenario: state.scenario, minute: state.minute, tank: state.tank, valves: [...state.valves], history: state.history.map(row => ({ ...row })), streaks: [...state.streaks], ...(state.sourceMode === 'connected' ? { sourceMode: 'connected', telemetrySnapshotId: state.telemetrySnapshotId, sourceLabel: state.sourceLabel, receivedAt: state.receivedAt, measuredAt: state.measuredAt } : {}) };
}
