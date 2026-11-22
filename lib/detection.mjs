// Shared transparent detector for internal and received readings.
export function detectReadings(zones, tank, previousStreaks = [0, 0, 0], CAPACITY = 20000) {
  const streaks = zones.map((z, i) => z.loss > Math.max(3, z.inflow * 0.15) ? previousStreaks[i] + 1 : 0);
  const alerts = [];
  zones.forEach((z, i) => {
    if (streaks[i] >= 3) alerts.push({
      id: `leak-${z.id}`,
      zone: z.id,
      severity: 'critical',
      title: `Suspected leak · Zone ${z.id}`,
      reason: `Inlet ${z.inflow.toFixed(1)} − outlet ${z.outflow.toFixed(1)} = ${z.loss.toFixed(1)} L/min. Exceeds max(3 L/min, 15% of inlet) for ${streaks[i]} consecutive samples.`,
      advice: 'Inspect zone meters and visible connections. Meter error or unmetered use could also explain an imbalance.'
    });
    if (z.outflow > z.base * 1.6) alerts.push({
      id: `demand-${z.id}`,
      zone: z.id,
      severity: 'warning',
      title: `Unusual consumption · Zone ${z.id}`,
      reason: `${z.outflow.toFixed(1)} L/min exceeds 160% of baseline ${z.base.toFixed(1)} L/min.`,
      advice: 'Check scheduled community use before investigating consumption.'
    });
  });
  if (tank < CAPACITY * .2) alerts.push({
    id: 'tank',
    severity: 'critical',
    title: 'Low central tank',
    reason: `${(tank / CAPACITY * 100).toFixed(1)}% is below the 20% threshold.`,
    advice: 'Review incoming supply and simulate a fair allocation. No real valves are controlled.'
  });
  return { streaks, alerts };
}
