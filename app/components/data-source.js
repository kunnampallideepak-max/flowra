"use client";
import { useEffect, useState } from 'react';
const time = value => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' }) + ' IST' : 'No readings received';
export function useConnectedTelemetry(mode) {
  const [telemetry, setTelemetry] = useState({ status: 'waiting', state: null, configured: null });
  const [error, setError] = useState('');
  useEffect(() => {
    if (mode !== 'connected') return;
    let stopped = false; let timer; let controller;
    const poll = async () => {
      controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 5000);
      try { const response = await fetch('/api/telemetry', { cache: 'no-store', signal: controller.signal }); if (!response.ok) throw new Error('Unavailable'); const data = await response.json(); if (!stopped) { setTelemetry(data); setError(''); } }
      catch { if (!stopped) setError('Telemetry server is unreachable. Displayed readings are retained history, not a live feed.'); }
      finally { clearTimeout(timeout); if (!stopped) timer = setTimeout(poll, 2000); }
    }; poll();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [mode]);
  return { ...telemetry, error, status: error ? 'disconnected' : telemetry.status };
}
export default function DataSource({ mode, change }) {
  return <section className="data-source-bar" aria-label="Data source"><div className="source-choice"><strong>Data source</strong><div role="group" aria-label="Select data source"><button aria-pressed={mode === 'simulation'} onClick={() => change('simulation')}>Internal simulation</button><button aria-pressed={mode === 'connected'} onClick={() => change('connected')}>Connected device</button></div></div>{mode === 'simulation' ? <p>Browser-generated readings · four reproducible scenarios · no device needed.</p> : <p>Received synthetic frames only. Connection details and setup instructions are below.</p>}</section>;
}
export function DeviceConnection({ mode, telemetry }) {
  if (mode !== 'connected') return <div className="settings-intro"><p>Internal simulation is selected. No device is needed and incoming telemetry cannot replace these readings.</p><details><summary>Connected-device setup</summary><p>Select Connected device above to inspect received frames. Use the documented authenticated HTTP sender; never put ingestion tokens in browser code or public firmware. Wokwi requires a suitable gateway or bridge to reach Flowra.</p></details></div>;
  return <div className="telemetry-connection"><strong className={`connection-${telemetry.status}`}>{telemetry.status === 'live' ? 'Receiving readings' : telemetry.status === 'stale' ? 'Stale readings' : telemetry.status === 'disconnected' ? 'Device disconnected' : 'Waiting for a device'}</strong><dl className="telemetry-facts"><div><dt>Data source</dt><dd>Connected device / synthetic telemetry</dd></div><div><dt>Connection status</dt><dd>{telemetry.status === 'live' ? 'Connected' : telemetry.status === 'stale' ? 'Stale' : 'Disconnected'}</dd></div><div><dt>Device ID</dt><dd>{telemetry.state?.deviceId || 'No device received'}</dd></div><div><dt>Last received time</dt><dd><time dateTime={telemetry.state?.receivedAt ? new Date(telemetry.state.receivedAt).toISOString() : undefined}>{time(telemetry.state?.receivedAt)}</time></dd></div><div><dt>Sensor source (sender-declared)</dt><dd>{telemetry.state?.sourceLabel || 'No source received'}</dd></div><div><dt>Latest reading status</dt><dd>{telemetry.state ? `${telemetry.status === 'live' ? 'Current frame' : 'Retained history'} / sequence ${telemetry.state.sequence}` : 'Awaiting first validated frame'}</dd></div>{telemetry.state && <div><dt>Device measured</dt><dd>{time(telemetry.state.measuredAt)}</dd></div>}</dl>{telemetry.configured === false && <p className="request-error">Ingestion is disabled. Configure a separate server-side FLOWRA_INGEST_TOKEN; the demo login cannot authenticate a device.</p>}{telemetry.error && <p role="alert" className="request-error">{telemetry.error}</p>}{telemetry.status === 'stale' && <p>Last readings are over 15 seconds old. They are not current.</p>}{telemetry.status === 'disconnected' && <p>No current feed. Last values and alerts are retained for inspection only.</p>}<details><summary>How to connect an ESP32-compatible sender</summary><p>Send a complete, authenticated JSON frame to POST /api/telemetry every five seconds. See the telemetry and Wokwi setup guides in the project. No token belongs in browser code, and Wokwi cannot reach localhost through its public gateway.</p></details></div>;
}
