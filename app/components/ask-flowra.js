"use client";
import AnswerMarkdown from './answer-markdown';

import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { formatElapsedTime } from '../../lib/elapsed-time.mjs';
import { snapshotKey, snapshotPayload } from '../../lib/snapshot.mjs';
import { SCENARIOS } from '../../lib/simulation.mjs';

const suggestions = ['Why is Zone B showing an alert?', 'Is there a possible leak?', 'How much water is available?', 'Which zone has the highest demand?', 'Why is a shortage predicted?', 'What does the allocation recommendation mean?', 'What can the operator inspect next?'];
export default function AskFlowra({ state, ref }) {
  const [session, setSession] = useState(null);
  const [turns, setTurns] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingEvidence, setPendingEvidence] = useState(null);
  const controller = useRef(null);
  const requestVersion = useRef(0);
  const end = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (turns.length) end.current?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }, [turns]);
  function replaceEvidence(snapshot, query = '') {
    controller.current?.abort(); requestVersion.current++;
    setSession(snapshot); setTurns([]); setQuestion(query); setBusy(false); setError(''); setPendingEvidence(null);
  }
  function reset() { replaceEvidence(snapshotPayload(state)); }
  useImperativeHandle(ref, () => ({
    openEvidence(snapshot, query) {
      setQuestion(query);
      if (!session) { setSession(snapshot); setPendingEvidence(null); }
      else if (snapshotKey(session) !== snapshotKey(snapshot)) setPendingEvidence({ snapshot, query });
      else setPendingEvidence(null);
    }
  }));
  async function send(event) {
    event.preventDefault();
    if (busy || !question.trim()) return;
    const frozen = session || snapshotPayload(state);
    if (!session) setSession(frozen);
    const query = question.trim();
    const history = turns.filter(turn => turn.available).slice(-4).flatMap(turn => [
      { role: 'user', text: turn.question, snapshotKey: snapshotKey(frozen) },
      { role: 'assistant', text: turn.explanation.slice(0, 1800), snapshotKey: snapshotKey(frozen) }
    ]);
    const version = ++requestVersion.current;
    controller.current = new AbortController();
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.current.signal, body: JSON.stringify({ ...frozen, question: query, conversation: history }) });
      const data = await response.json();
      if (version !== requestVersion.current) return;
      if (!response.ok && !data.explanation) throw new Error('Request failed');
      if (!data.explanation || typeof data.available !== 'boolean') throw new Error('Invalid response');
      setTurns(previous => [...previous, { question: query, ...data }].slice(-20)); setQuestion('');
    } catch (failure) {
      if (failure.name !== 'AbortError' && version === requestVersion.current) setError('Ask Flowra is unavailable: the server could not complete this request. No AI answer was generated. Your question is kept so you can retry.');
    } finally { if (version === requestVersion.current) setBusy(false); }
  }
  const changed = session && snapshotKey(session) !== snapshotKey(state);
  return <section className="panel assistant" aria-labelledby="assistant-title">
    <div className="panel-head"><div><h2 id="assistant-title">Ask Flowra</h2><p>Ask a question in your own words. Answers explain the evidence; they cannot operate valves.</p></div><span className="badge">Snapshot assistant</span></div>
    {pendingEvidence && <div className="evidence-choice" role="status"><strong>New evidence from Analysis / T+{formatElapsedTime(pendingEvidence.snapshot.minute)}</strong><p>Your existing conversation still uses its original frozen snapshot. Choose this alert snapshot to start a fresh conversation, or continue with the original evidence.</p><div><button className="button primary" onClick={() => replaceEvidence(pendingEvidence.snapshot, pendingEvidence.query)}>Use alert snapshot</button><button className="button secondary" onClick={() => setPendingEvidence(null)}>Keep frozen conversation</button></div></div>}
    <div className="assistant-snapshot"><div><strong>{session ? `${(session.sourceLabel || SCENARIOS[session.scenario])} · frozen at T+${formatElapsedTime(session.minute)}` : 'Your first question captures the current network'}</strong><p>{changed ? 'The live network has changed. Follow-ups still use this frozen snapshot; start a new conversation for the latest readings.' : 'All readings are simulated. One conversation uses one snapshot, including its alerts, forecast and allocation.'}</p></div><button className="button secondary" onClick={reset}>Use latest snapshot</button></div>
    <div className="snapshot-evidence">Snapshot evidence: {(session || state).networkId && <span>{state.networkLabel} / </span>}tank {Math.round((session || state).tank).toLocaleString('en-IN')} L. {(session || state).receivedAt ? `Device frame received ${new Date((session || state).receivedAt).toISOString()}.` : 'Internal simulation.'} Model answers should be checked against this frozen evidence.</div><div className="conversation" role="log" aria-label="Flowra conversation" aria-live="polite" aria-relevant="additions" aria-busy={busy}>
      {!turns.length && <div className="chat-empty"><strong>What would you like to understand?</strong><p>Try asking about an alert, available water, or the fairest allocation. AI-generated answers are labeled only after a successful response.</p></div>}
      {turns.map((turn, index) => <article className="chat-turn" key={index}><div className="question"><strong>You</strong><p>{turn.question}</p></div><div className={`answer ${turn.available ? '' : 'unavailable'}`}><strong>{turn.available ? 'Flowra Assistant' : 'AI response unavailable'}</strong>{turn.available && <span className="answer-origin">AI-generated response</span>}{turn.message && <p>{turn.message}</p>}{!turn.available && <p className="fallback-label">Rules-based snapshot summary, not a generated answer to your question.</p>}<AnswerMarkdown text={turn.explanation} /><small>{session.sourceLabel || SCENARIOS[session.scenario] || 'Connected synthetic telemetry'} · T+{formatElapsedTime(session.minute)} · simulated readings{turn.available ? ' · advisory answer' : ''}</small></div></article>)}
      <div ref={end}/>
    </div>
    <div className="suggestions" aria-label="Suggested questions">{suggestions.map(text => <button key={text} disabled={busy} onClick={() => { setQuestion(text); document.getElementById('flowra-question')?.focus(); }}>{text}</button>)}</div>
    <form onSubmit={send} className="chat-form"><label htmlFor="flowra-question">Your question about this water network</label><textarea id="flowra-question" value={question} maxLength={800} rows={3} onChange={event => setQuestion(event.target.value)} placeholder="For example: why is a shortage predicted?" aria-describedby="question-help" disabled={busy}/><div className="chat-form-footer"><small id="question-help">{question.length}/800 characters · Questions never execute physical actions.</small><button type="submit" className="button primary" disabled={busy || !question.trim()}>{busy ? 'Asking Flowra…' : 'Send question'}</button></div>{busy && <p role="status">Waiting for the server. An answer will appear here when the request completes.</p>}{error && <p role="alert" className="request-error">{error}</p>}</form>
  </section>;
}
