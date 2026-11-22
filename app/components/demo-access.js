"use client";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { AppearanceSelector, LoginAppearance, settleAppearance } from './appearance';
import { DEMO_SESSION_KEY, DEMO_USER, DEMO_PASSWORD, validDemoLogin } from '../../lib/demo-access.mjs';
const subscribe = listener => { window.addEventListener('flowra-demo-access', listener); window.addEventListener('storage', listener); return () => { window.removeEventListener('flowra-demo-access', listener); window.removeEventListener('storage', listener); }; };
const loggedIn = () => { try { return sessionStorage.getItem(DEMO_SESSION_KEY) === DEMO_USER ? 'signed-in' : 'signed-out'; } catch { return 'signed-out'; } };
function setAccess(value) { try { if (value) sessionStorage.setItem(DEMO_SESSION_KEY, DEMO_USER); else sessionStorage.removeItem(DEMO_SESSION_KEY); } catch { return false; } window.dispatchEvent(new Event('flowra-demo-access')); return true; }
const SessionActions = createContext(() => setAccess(false));
export function DemoProfile() {
  const signOut = useContext(SessionActions);
  const [open, setOpen] = useState(false); const [touch, setTouch] = useState(false); const dialog = useRef(null); const trigger = useRef(null); const menu = useRef(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    const keyboard = () => setTouch(false);
    window.addEventListener('keydown', keyboard, true);
    return () => window.removeEventListener('keydown', keyboard, true);
  }, []);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector('button')?.focus();
    const key = event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); } };
    const focus = event => { if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('keydown', key); document.addEventListener('focusin', focus);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('focusin', focus); };
  }, [open]);
  return <div className="demo-profile" data-open={open} data-touch={touch}><button ref={trigger} onPointerDown={event => setTouch(event.pointerType === 'touch')} className="profile-button" aria-controls="operator-menu" aria-label="Operator profile" aria-expanded={open} onClick={() => setOpen(value => !value)} onKeyDown={event => { setTouch(false); if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}><span className="profile-surface" aria-hidden="true"/><span className="profile-avatar" aria-hidden="true">OP</span><span className="profile-label" aria-hidden="true">Demo operator</span></button>{open && <button className="profile-dismiss" aria-label="Close profile menu" tabIndex={-1} onClick={close}/>}<div ref={menu} data-open={open} aria-hidden={!open} inert={!open} id="operator-menu" className="profile-dropdown" role="region" aria-label="Operator menu"><strong>Flowra operator</strong><small>Public demo account · no hardware access</small><button onClick={() => { setOpen(false); dialog.current?.showModal(); }}>View demo profile</button><AppearanceSelector/><button onClick={() => { setOpen(false); signOut(); }}>Sign out</button></div><dialog ref={dialog} className="profile-dialog" aria-labelledby="profile-title" onClose={() => trigger.current?.focus()}><h2 id="profile-title">Demo operator profile</h2><dl><dt>Username</dt><dd>operator</dd><dt>Role</dt><dd>Community water operator (demo)</dd><dt>Workspace</dt><dd>Flowra demonstration network</dd><dt>Permissions</dt><dd>Explore synthetic data and virtual plans. No physical controls.</dd></dl><p>This public demo login is stored in this browser tab. It is not production authentication and does not protect ingestion or backend services.</p><button className="button primary" onClick={() => dialog.current?.close()}>Close profile</button></dialog></div>;
}
const loginMessages = {
  both: 'Enter both your username and password to continue.',
  username: 'Enter your username to continue.',
  password: 'Enter your password to continue.',
  credentials: 'The demo username or password is incorrect.',
  storage: 'Enable browser session storage to sign in.'
};
function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState({ issue: '', visible: false });
  const issue = feedback.visible ? feedback.issue : '';
  const invalid = field => issue === 'both' || issue === field;

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const username = data.get('username'), password = data.get('password');
    let next;
    if (!username.trim()) next = password ? 'username' : 'both';
    else if (!password) next = 'password';
    else if (!validDemoLogin(username, password)) next = 'credentials';
    else if (!setAccess(true)) next = 'storage';
    if (!next) return;
    flushSync(() => setFeedback({ issue: next, visible: true }));
    if (['username', 'password', 'both'].includes(next)) {
      form.elements.namedItem(next === 'both' ? 'username' : next).focus();
    }
  }
  function edit(event) {
    if (!issue) return;
    const form = event.currentTarget;
    // Clear only submitted errors. Typing (including autofill) never starts validation.
    const usernameMissing = invalid('username') && !form.elements.username.value.trim();
    const passwordMissing = invalid('password') && !form.elements.password.value;
    const remaining = usernameMissing && passwordMissing ? 'both' : usernameMissing ? 'username' : passwordMissing ? 'password' : '';
    if (remaining !== issue) setFeedback({ issue: remaining || issue, visible: Boolean(remaining) });
  }
  return <form noValidate onSubmit={submit} onInput={edit}>
    <label htmlFor="demo-username">Username</label>
    <input id="demo-username" name="username" autoComplete="username" placeholder="operator" required
      aria-invalid={invalid('username')} aria-describedby={invalid('username') ? 'login-error' : undefined}/>
    <label htmlFor="demo-password">Password</label>
    <div className="password-field">
      <input id="demo-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
        placeholder="Enter demo password" required aria-invalid={invalid('password')}
        aria-describedby={invalid('password') ? 'login-error' : undefined}/>
      <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
        onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
    </div>
    <div className="login-feedback">
      <span aria-hidden="true" className="feedback-size">{loginMessages.both}</span>
      <span aria-hidden="true" className="feedback-message" data-visible={feedback.visible}>{loginMessages[feedback.issue]}</span>
      <span className="sr-only" id="login-error" role="alert" aria-atomic="true">{loginMessages[issue]}</span>
    </div>
    <button className="button primary" type="submit">Sign in</button>
  </form>;
}

export default function DemoAccess({ children }) {
  const signedIn = useSyncExternalStore(subscribe, loggedIn, () => 'checking');
  const [departing, setDeparting] = useState(false);
  useEffect(() => {
    if (!departing) return;
    const timeout = setTimeout(() => setDeparting(false), 280);
    return () => clearTimeout(timeout);
  }, [departing]);
  function signOut() {
    // Remove the session and unmount the dashboard before returning from the action.
    // Only a neutral brand veil remains; no authenticated DOM is retained for animation.
    settleAppearance();
    flushSync(() => { setDeparting(!matchMedia('(prefers-reduced-motion: reduce)').matches); setAccess(false); });
    document.getElementById('demo-username')?.focus({ preventScroll: true });
  }
  if (signedIn === 'checking') return <main className="session-loading" role="status" aria-label="Checking demo session"><strong>flowra<span>.</span></strong><p>Opening your workspace...</p></main>;
  if (signedIn === 'signed-in') return <SessionActions.Provider value={signOut}><div className="session-arrival">{children}</div></SessionActions.Provider>;
  return <><main className="login-page session-arrival"><section className="login-story"><a href="#" className="login-brand" aria-label="Flowra">flowra<span>.</span></a><div><span className="eyebrow">WATER INTELLIGENCE</span><h1>Understand the flow.<br/>Plan for every zone.</h1><p>A clear view of water storage, unusual flow and fair distribution, built for community operators.</p><div className="login-network" aria-hidden="true"><span>Source</span><i>→</i><strong>Central tank</strong><i>→</i><span>Zones A · B · C</span></div></div><p className="login-footnote">All example readings are synthetic. Virtual decisions never control physical infrastructure.</p></section><section className="login-form-panel"><div className="login-form"><LoginAppearance/><h2>Sign in to Flowra</h2><p>Explore your water network with the demo operator account.</p><SignInForm/><div className="demo-credentials"><strong>Demo access</strong><p>Username: <code>{DEMO_USER}</code><br/>Password: <code>{DEMO_PASSWORD}</code></p></div><p className="login-limit">Demonstration login only. These shared credentials are not secure production authentication and do not authorize device ingestion or real hardware operations.</p></div></section></main>{departing && <div className="session-departure" aria-hidden="true" onAnimationEnd={() => setDeparting(false)}><strong>flowra<span>.</span></strong></div>}</>;
}
