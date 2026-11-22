"use client";

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DemoAccess, { DemoProfile } from './components/demo-access';
import DataSource, { DeviceConnection, useConnectedTelemetry } from './components/data-source';
import AnswerMarkdown from './components/answer-markdown';
import { formatElapsedTime } from '../lib/elapsed-time.mjs';
import { snapshotPayload } from '../lib/snapshot.mjs';
import { advance, allocate, createSimulation, explain, forecast, SCENARIOS } from '../lib/simulation.mjs';
const fmt = (n, d = 0) => n.toLocaleString('en-IN', {
  maximumFractionDigits: d
});
import AskFlowra from './components/ask-flowra';
import DemoNotes from './components/demo-notes';
import { NetworkPreview, NetworkDetail } from './components/network';
import Networks from './components/networks';
import { DEFAULT_NETWORK, hasDeviceMapping, networkCaption } from '../lib/networks.mjs';
import HowItWorks from './components/how-it-works';
import TermGlossary from './components/term-glossary';
const tabs = [['overview', 'Overview', '◫'], ['networks', 'Networks', '▦'], ['network', 'Digital twin', '◇'], ['analysis', 'Analysis & alerts', '⌁'], ['allocation', 'Allocation lab', '≋'], ['ask', 'Ask Flowra', '◌'], ['learn', 'How Flowra works', '?'], ['about', 'Demo & settings', 'ⓘ']];
const sensorTerms = [
  ['L/min', 'Litres per minute. 24 L/min means 24 litres passing the sensor in one simulated minute.'],
  ['Flow imbalance', 'Water entering a zone minus water delivered. A persistent difference can suggest a loss, but does not confirm a leak.'],
  ['Persistent samples', 'Readings in a row. A suspected leak needs three consecutive readings above the imbalance threshold.']
];
const allocationTerms = [
  ['Planning horizon', 'How far ahead a plan looks. Here it is 120 simulated minutes, or two hours.'],
  ['Demand coverage', 'The share of water needs met. At 60% coverage, a zone gets 60 of every 100 litres it needs.'],
  ['Unmet demand', 'Water needed but not delivered. If a zone needs 100 L and receives 60 L, unmet demand is 40 L.']
];
function Card({
  title,
  extra,
  children
}) {
  return <section className="panel"><div className="panel-head"><h2>{title}</h2>{extra}</div>{children}</section>;
}
export default function Home() { return <DemoAccess><Dashboard /></DemoAccess>; }
function Dashboard() {
  const [activeNetwork, setActiveNetwork] = useState(DEFAULT_NETWORK);
  const networkBank = useRef(new Map());
  const stage = useRef(null), heading = useRef(null), assistant = useRef(null);
  const [simulation, setS] = useState(() => createSimulation());
  const [mode, setMode] = useState('simulation');
  const telemetry = useConnectedTelemetry(mode);
  const connected = mode === 'connected';
  const mapped = hasDeviceMapping(activeNetwork);
  const hasData = !connected || (mapped && Boolean(telemetry.state));
  const shownTelemetry = mapped ? telemetry : { status: 'waiting', state: null, configured: telemetry.configured, error: '' };
  const rawState = connected && mapped && telemetry.state ? telemetry.state : simulation;
  const s = activeNetwork.id === DEFAULT_NETWORK.id ? rawState : { ...rawState, networkId: activeNetwork.id, networkLabel: networkCaption(activeNetwork) };
  const [tab, setTab] = useState(() => typeof window !== 'undefined' && tabs.some(item => item[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'overview');
  const [running, setRunning] = useState(true);
  const [selected, select] = useState('tank');
  const [draft, setDraft] = useState([100, 100, 100]);
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const req = useRef(0);
  useEffect(() => {
    if (!running || connected) return;
    let timer = setInterval(() => setS(v => advance(v)), 2000);
    return () => clearInterval(timer);
  }, [running, connected, activeNetwork.id]);
  useEffect(() => {
    const read = () => {
      let t = location.hash.slice(1);
      if (tabs.some(x => x[0] === t)) {
        setTab(t);
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    };
    read();
    addEventListener('hashchange', read);
    return () => removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    const active = document.querySelector('.sidebar nav [aria-current="page"]');
    if (!active) return;
    active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const nav = active.parentElement;
    // Browser zoom can turn the sidebar into a horizontal row mid-page.
    const observer = new ResizeObserver(() => {
      if (nav.scrollWidth <= nav.clientWidth) return;
      const link = active.getBoundingClientRect(), row = nav.getBoundingClientRect();
      if (link.left < row.left) nav.scrollLeft += link.left - row.left;
      else if (link.right > row.right) nav.scrollLeft += link.right - row.right;
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, [tab]);
  useLayoutEffect(() => {
    if (document.activeElement === document.body) heading.current?.focus({ preventScroll: true });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && stage.current?.animate) {
      const motion = stage.current.animate([{ opacity: .6, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' });
      return () => motion.cancel();
    }
  }, [tab]);
  function openAssistant(alert) {
    assistant.current?.openEvidence(snapshotPayload(s), alert ? `Why is ${alert.title} showing? What evidence supports it and what can I inspect next?` : 'What does the current network evidence show, and what should I inspect next?');
    window.history.pushState(null, '', '#ask');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    requestAnimationFrame(() => document.getElementById('flowra-question')?.focus({ preventScroll: true }));
  }
  function activateNetwork(network) {
    if (network.id !== activeNetwork.id) {
      networkBank.current.set(activeNetwork.id, { simulation, draft });
      const saved = networkBank.current.get(network.id);
      setS(saved?.simulation || createSimulation()); setDraft(saved?.draft || [100, 100, 100]);
      setActiveNetwork(network); select('tank'); setAi(null); setBusy(false); req.current++;
      setNotice(`${networkCaption(network)}. Separate simulation restored; no device association was changed. Assistant context starts fresh for this network.`);
    }
    location.hash = 'network';
  }
  const f = forecast(s),
    a = allocate(s, draft),
    z = s.zones.find(v => v.id === selected);
  function scenario(id) {
    setS(prev => ({
      ...createSimulation(id),
      events: [...prev.events, ...prev.alerts.map(v => ({
        ...v,
        minute: prev.minute,
        status: 'Resolved on scenario reset'
      }))].slice(-100)
    }));
    setDraft([100, 100, 100]);
    setAi(null);
    req.current++;
    setBusy(false);
    setNotice(`${SCENARIOS[id]} reset to reproducible initial conditions.`);
  }
  async function ask() {
    let snap = s,
      id = ++req.current;
    setBusy(true);
    setAi(null);
    try {
      let r = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(snapshotPayload(snap))
      });
      let data = await r.json();
      if (id === req.current) setAi({
        ...data,
        available: r.ok && data.available === true && Boolean(data.explanation),
        explanation: data.explanation || explain(snap),
        minute: snap.minute
      });
    } catch {
      if (id === req.current) setAi({
        available: false,
        message: 'AI explanation unavailable: server connection failed.',
        explanation: explain(snap),
        minute: snap.minute
      });
    } finally {
      if (id === req.current) setBusy(false);
    }
  }
  function download() {
    let url = URL.createObjectURL(new Blob([JSON.stringify({
      network: { ...activeNetwork, sensorNamespace: activeNetwork.id, verification: 'Illustrative only; no real pipeline verification' },
      label: connected ? 'Flowra received synthetic device telemetry' : 'Flowra internal simulation',
      ...s,
      forecast: f
    }, null, 2)], {
      type: 'application/json'
    }));
    let el = document.createElement('a');
    el.href = url;
    const exportTime = connected ? formatElapsedTime(s.minute).replaceAll(' ', '') : s.minute;
    el.download = `flowra-${s.scenario}-${exportTime}.json`;
    el.click();
    URL.revokeObjectURL(url);
  }
  const alerts = <Card title={connected && telemetry.status !== 'live' ? 'Alerts at last reading' : 'Active alerts'} extra={<span className="badge">{s.alerts.length} active</span>}>{s.alerts.length ? s.alerts.map(v => <details className="alert" key={v.id}><summary>△ {v.title}<span>{v.severity}</span></summary><p>{v.reason}</p><p>{v.advice}</p><button className="button secondary" onClick={() => openAssistant(v)}>Ask Flowra about this alert</button></details>) : <div className="empty"><span className="check">✓</span><strong>Everything is flowing.</strong><p>No active detection thresholds exceeded.</p>{s.streaks.some(v => v > 0) && <p>Collecting evidence: {Math.max(...s.streaks)} / 3 imbalance samples.</p>}</div>}<div className="panel-foot">Rule-based detection · expand alerts for evidence</div></Card>;
  return <div className="app-shell"><aside className="sidebar"><a href="#overview" className="brand" aria-label="Flowra overview"><span className="brand-mark"><svg width="23" height="27" viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="M12 2S3 12 3 18a9 9 0 0 0 18 0C21 12 12 2 12 2Z" stroke="currentColor" strokeWidth="2" /><path d="M7 19c0 3 2 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span><span>flowra<span className="dot">.</span></span></a><div className="workspace-label">WATER INTELLIGENCE</div><nav aria-label="Main navigation">{tabs.map(([id, label, icon]) => <a key={id} aria-label={label} href={`#${id}`} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : ''}><span>{icon}</span><span className="nav-label">{label}</span>{id === 'analysis' && hasData && s.alerts.length > 0 && <b>{s.alerts.length}</b>}</a>)}</nav></aside><main><a className="skip-link" href="#main-content">Skip to main content</a><header className="topbar"><span><span className="muted">Workspace / </span>Community water network</span><span className="live" data-status={connected ? shownTelemetry.status : running ? 'running' : 'paused'}><i />{connected ? (!mapped ? 'No matching device' : telemetry.status === 'live' ? 'Device connected' : telemetry.status === 'stale' ? 'Stale' : 'Disconnected') : (running ? 'Demo running' : 'Demo paused')}</span><DemoProfile /></header><div className="content" id="main-content" tabIndex={-1}><div className="page-heading"><div><div className="eyebrow">FLOWRA OPERATIONS CENTER</div><h1 ref={heading} tabIndex={-1}>{tabs.find(v => v[0] === tab)?.[1]}</h1><p>{tab === 'overview' ? 'Every drop accounted for. Every community connected.' : tab === 'allocation' ? 'Test fairer distribution before making a decision.' : tab === 'analysis' ? 'From sensor evidence to explainable decisions.' : tab === 'networks' ? 'Real places. Transparent, illustrative water networks.' : tab === 'network' ? 'One network. A shared view of every flow.' : tab === 'ask' ? 'Ask questions grounded in your network simulation readings.' : tab === 'learn' ? 'Understand the network, one simple step at a time.' : 'Choose demo conditions, manage sources and understand the prototype.'}</p></div><div className="header-actions"><button className="button secondary" onClick={download} disabled={!hasData}>↓ Export snapshot</button></div></div><div className="disclosure compact-disclosure"><span>Synthetic demo data / {connected ? 'connected source' : SCENARIOS[simulation.scenario]}{activeNetwork.location ? ` / ${activeNetwork.location.locality} (illustrative)` : ''}</span></div><div className="notice" role="status">{notice}</div>{connected && tab === 'about' && <p className="source-honesty">Connected device data is synthetic and received over HTTP. The source label is declared by the authenticated sender. No physical water infrastructure is connected. Valve controls are preview-only in this mode.</p>}{!hasData && tab !== 'about' && tab !== 'learn' && tab !== 'networks' && <section className="panel no-telemetry"><h2>{mapped ? 'No device readings received' : 'No connected telemetry for this network'}</h2><p>Flowra will not invent connected readings. Only the default network has a configured synthetic device mapping. Start an authenticated sender or switch to Internal simulation to explore the existing scenarios.</p><a className="button primary" href="#about">Open data source settings</a></section>}<div hidden={!hasData && tab !== 'learn' && tab !== 'about' && tab !== 'networks'} ref={stage} className={`page-stage ${connected && shownTelemetry.status !== 'live' ? 'retained-telemetry' : ''}`}>
 <div hidden={tab !== 'networks'}><Networks active={activeNetwork} activate={activateNetwork} connected={connected}/></div>
 {tab === 'overview' && <><div className="metrics">{[{
              label: 'Central tank level',
              value: fmt(s.level, 1),
              unit: '%',
              sub: `${fmt(s.tank)} of 20,000 L capacity`,
              icon: '▱',
              progress: s.level
            }, {
              label: 'Distribution flow',
              value: fmt(s.total, 1),
              unit: 'L/min',
              sub: `${fmt(s.source, 1)} L/min incoming source`,
              icon: '⌁'
            }, {
              label: 'Water reaching zones',
              value: fmt(s.consumption, 1),
              unit: 'L/min',
              sub: `${fmt(s.loss, 1)} L/min measured imbalance`,
              icon: '♧'
            }, {
              label: 'Network status',
              value: connected && telemetry.status !== 'live' ? 'Historical' : s.alerts.length ? `${s.alerts.length} ${s.alerts.length === 1 ? 'alert' : 'alerts'}` : 'Healthy',
              unit: '',
              sub: '3 zones · 50 households · synthetic',
              icon: '◇'
            }].map(m => <div className="metric" key={m.label}><div className="metric-top">{m.label}<span>{m.icon}</span></div><div className="metric-value">{m.value}<small>{m.unit}</small></div><p>{m.sub}</p>{m.progress != null && <div className="progress"><span style={{
                  width: `${m.progress}%`
                }} /></div>}</div>)}</div><div className="primary-grid"><NetworkPreview state={s} /><div className="right-stack">{alerts}<section className="forecast-card"><small>LOOKING AHEAD · NEXT 2 HOURS</small><h2>{f.shortage > 0 ? `${fmt(f.shortage)} L` : 'Supply on track'}</h2><p>{f.shortage > 0 ? 'Projected shortfall above the safety reserve' : 'Forecast demand fits the available water budget'}</p><div><span>Reserve reached in</span><strong>{f.reserveMinutes === null ? 'Not projected' : `${fmt(f.reserveMinutes)} min`}</strong></div><a href="#allocation">Open allocation lab <span>↗</span></a></section></div></div>{tab === 'overview' && <div className="secondary-grid"><Card title="Flow over time" extra={<span className="muted">L/min · latest 90 samples</span>}><div className="chart"><ResponsiveContainer width="100%" height="100%" initialDimension={{
                  width: 600,
                  height: 220
                }}><AreaChart data={s.history}><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--chart-flow)" stopOpacity=".24" /><stop offset="1" stopColor="var(--chart-flow)" stopOpacity="0" /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--grid)" /><XAxis dataKey="minute" axisLine={false} tickLine={false} tick={{
                      fill: 'var(--muted)', fontSize: 13
                    }} tickFormatter={v => `${fmt(v, 1)}m`} /><YAxis axisLine={false} tickLine={false} tick={{
                      fill: 'var(--muted)', fontSize: 13
                    }} /><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)' }} labelStyle={{ color: 'var(--ink)' }} labelFormatter={v => `Snapshot at T+${formatElapsedTime(v)}`} formatter={(v, n) => [`${fmt(v, 1)} L/min`, n]} /><Area dataKey="total" name="Distribution" stroke="var(--chart-flow)" fill="url(#area)" strokeWidth={2.5} isAnimationActive={false} /><Area dataKey="source" name="Source" stroke="var(--chart-source)" fill="none" strokeDasharray="5 4" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div><div className="chart-key">● Distribution <span>● Source inflow</span></div></Card><Card title="Zone pulse" extra={<span className="muted">Delivered / demand</span>}>{s.zones.map(v => <button className="zone-row" key={v.id} onClick={() => {
                select(v.id);
                location.hash = 'network';
              }}><span className="zone-avatar">{v.id}</span><div><strong>{v.name}</strong><p>{v.households} households</p><div className="progress"><span style={{
                      width: `${Math.min(100, v.outflow / v.demand * 100)}%`
                    }} /></div></div><strong>{fmt(v.outflow, 1)}<small> / {fmt(v.demand, 1)} L/min</small></strong></button>)}</Card></div>}</>}
<div hidden={tab !== 'network'}>{tab === 'network' && <NetworkDetail networkName={activeNetwork.name} networkContext={networkCaption(activeNetwork)} template={activeNetwork.template} state={s} selected={selected} select={select} draft={draft} setDraft={setDraft} readOnly={connected} apply={() => { if (connected) return; setS(previous => advance(previous, draft)); setNotice('Virtual valves applied to the shared live simulation.'); }} />}</div>
 {tab === 'learn' && <HowItWorks />}
 {tab === 'analysis' && <><div className="secondary-grid">{alerts}<Card title="Evidence-based explanation" extra={<span className="badge">Optional AI explanation</span>}><div className="explanation"><p>Explain a frozen snapshot of the actual displayed simulation. Rule-based detection works independently of the assistant.</p><button className="button primary" disabled={busy} onClick={ask}>{busy ? 'Requesting explanation…' : 'Explain this snapshot'}</button>{ai && <div className="ai-result"><strong>{ai.available ? `Flowra Assistant / T+${formatElapsedTime(ai.minute)}` : 'AI explanation unavailable'}</strong>{ai.message && <p>{ai.message}</p>}<small>{ai.available ? 'Model-generated interpretation. Verify against sensor evidence.' : `Rules-based fallback · snapshot at T+${formatElapsedTime(ai.minute)}`}</small><AnswerMarkdown text={ai.explanation} /></div>}</div></Card></div><TermGlossary label="Sensor definitions" terms={sensorTerms}/><Card title="Observed synthetic sensors"><div className="table-wrap"><table><thead><tr><th>Zone</th><th>Inlet L/min</th><th>Outlet L/min</th><th>Imbalance L/min</th><th>Persistent samples</th><th>Demand L/min</th></tr></thead><tbody>{s.zones.map((v, i) => <tr key={v.id}><td>Zone {v.id}</td><td>{fmt(v.inflow, 2)}</td><td>{fmt(v.outflow, 2)}</td><td>{fmt(v.loss, 2)}</td><td>{s.streaks[i]} / 3</td><td>{fmt(v.demand, 2)}</td></tr>)}</tbody></table></div></Card><Card title="Alert timeline" extra={<span className="muted">Latest 100 events · retained across scenarios</span>}>{s.events.length ? [...s.events].reverse().map((e, i) => <div className="timeline" key={i}><span className="badge">T+{formatElapsedTime(e.minute)}</span><div><strong>{e.title}</strong><p>{e.reason}</p></div><span className="badge">{e.status}</span></div>) : <div className="empty"><p>{connected ? 'No received alert events yet. Wait for incoming frames or return to Internal simulation to test a scenario.' : 'No events yet. Run suspected leak for three samples.'}</p></div>}</Card><section className="assistant-context" aria-label="Ask about current evidence"><div><h2>Discuss the evidence with Flowra</h2><p>Open the dedicated assistant with this snapshot. Existing conversations stay frozen until you choose new evidence.</p></div><button className="button secondary" onClick={() => openAssistant()}>Ask Flowra about current evidence</button></section></>}
<div hidden={tab !== 'ask'}><AskFlowra ref={assistant} key={activeNetwork.id} state={s} /></div>
 {tab === 'allocation' && <><div className="allocation-banner"><div><small>NEXT TWO SIMULATED HOURS</small><h2>Share the supply. Protect the reserve.</h2><p>Give each zone the same fraction of its predicted need while accounting for observed losses.</p></div><div><strong>{fmt(a.available)} L</strong><span>available above a 2,000 L reserve</span></div></div><div className="secondary-grid"><Card title="Virtual valve workbench" extra={<span className="badge">Simulation only</span>}><div className="valves">{s.zones.map((v, i) => <div className="valve" key={v.id}><label htmlFor={`valve-${v.id}`}><strong>Zone {v.id} · {v.name}</strong><span>{draft[i]}%</span></label><input id={`valve-${v.id}`} type="range" min="0" max="100" value={draft[i]} onChange={e => setDraft(d => d.map((n, j) => i === j ? Number(e.target.value) : n))} /><small>Applied: {s.valves[i]}% · predicted need {fmt(a.needs[i])} L</small></div>)}<div className="action-row"><button className="button primary" disabled={connected} onClick={() => {
                    if (connected) return;
                    setS(v => advance(v, draft));
                    setNotice('Virtual valves applied to the shared live simulation.');
                  }}>Apply virtual valves</button><button className="button secondary" onClick={() => {
                    setDraft(a.proposedValves);
                    setNotice(connected ? 'Fair allocation loaded into preview only. Device commands are not supported.' : 'Fair plan loaded into preview. Apply virtual valves to run it.');
                  }}>Load fair plan</button><button className="text-button" onClick={() => setDraft([100, 100, 100])}>Reset preview</button></div></div></Card><Card title="Outcome preview"><div className="outcomes">{[['Unmet demand · your preview', `${fmt(a.unmet)} L`], ['Unmet demand · fair proposal', `${fmt(a.proposedUnmet)} L`], ['Least-served zone · preview', `${fmt(a.fairness, 1)}%`], ['Least-served zone · fair plan', `${fmt(a.proposedFairness, 1)}%`]].map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div><p className="inset-note">Maximizes minimum demand coverage across zones. It does not repair leaks or create water. With fully open valves, the current plan may already be fair.</p></Card></div><TermGlossary label="Allocation definitions" terms={allocationTerms}/><Card title="Allocation comparison"><div className="table-wrap"><table><thead><tr><th>Zone</th><th>Predicted demand</th><th>Your preview</th><th>Fair proposal</th><th>Proposed opening</th></tr></thead><tbody>{s.zones.map((v, i) => <tr key={v.id}><td>Zone {v.id} · {v.households} households</td><td>{fmt(a.needs[i])} L</td><td>{fmt(a.current[i])} L</td><td>{fmt(a.proposed[i])} L</td><td>{a.proposedValves[i]}%</td></tr>)}</tbody></table></div><p className="inset-note">Budget = max(0, tank − 2,000 L) + source × 120. Proposal fraction = min(1, budget / predicted need including losses). Preview uses current zone demand; live readings change after application. Source and demand are held constant over the planning horizon.</p></Card></>}
 {tab === 'about' && <><div className="settings-controls"><Card title="Data source & connection"><DataSource mode={mode} telemetry={shownTelemetry} change={next => { setMode(next); setDraft(next === 'simulation' ? simulation.valves : shownTelemetry.state?.valves || [100,100,100]); setAi(null); req.current++; setBusy(false); setNotice(next === 'connected' ? 'Connected mode shows only received device readings. No hardware controls are available.' : 'Internal simulation restored.'); }} /></Card><Card title="Scenario studio"><p className="settings-intro">Choose a reproducible synthetic network condition. Scenarios affect every operational page.</p><div className="simulation-bar"><div className="scenario-buttons">{Object.entries(SCENARIOS).map(([id, label]) => <button key={id} disabled={connected} aria-pressed={!connected && s.scenario === id} className={!connected && s.scenario === id ? 'selected' : ''} onClick={() => scenario(id)}>{label}</button>)}</div><span className="sim-time">{connected ? 'Scenarios disabled in connected mode' : `T+${formatElapsedTime(s.minute)}`}</span></div></Card><Card title="Simulation controls"><div className="settings-actions"><button className="button primary" disabled={connected} onClick={() => setRunning(value => !value)}>{running ? 'Pause' : 'Resume'}</button><button className="button secondary" disabled={connected} onClick={() => scenario(simulation.scenario)}>Reset current scenario</button><span className="badge">{SCENARIOS[simulation.scenario]} / {connected ? 'internal simulation suspended' : `T+${formatElapsedTime(simulation.minute)}`}</span></div><p className="settings-intro">{connected ? 'An external sender controls its own transmission. These buttons cannot pause, reset or control it. Your internal simulation is retained.' : 'Reset restores this scenario and its virtual valves to their initial conditions. It preserves appearance, demo session, data source, saved conversation and retained alert history. Pause and Resume affect only this browser simulation.'}</p></Card></div><Card title="Connected-device status & setup"><DeviceConnection mode={mode} telemetry={shownTelemetry}/></Card><DemoNotes/></>}
</div><footer><span><strong>flowra.</strong> Water intelligence for stronger communities.</span><span>Synthetic data · Operator decisions · Human oversight</span></footer></div></main></div>;
}
