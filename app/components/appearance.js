"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';

const key = 'flowra-appearance';
const choices = ['light', 'dark', 'system', 'contrast'];
let memory;
let themeMotion, pendingTheme, themeVersion = 0;
// Read storage once per page; a local selection remains usable if persistence is blocked.
function preference() { if (memory) return memory; try { const value = localStorage.getItem(key); return choices.includes(value) ? value : 'system'; } catch { return 'system'; } }
function snapshot() { const value = preference(); return `${value}:${value === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value}`; }
function apply(animate = false) {
  const target = snapshot(), [value, resolved] = target.split(':');
  const root = document.documentElement;
  if (pendingTheme === target) return;
  if (!pendingTheme && root.dataset.theme === resolved && root.dataset.appearance === value) return;
  const version = ++themeVersion;
  themeMotion?.skipTransition(); pendingTheme = null;
  const previous = root.dataset.theme;
  const commit = () => { if (version !== themeVersion) return; root.dataset.appearance = value; root.dataset.theme = resolved; pendingTheme = null; };
  const motion = animate && previous && previous !== resolved &&
    !matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)').matches;
  if (motion && document.startViewTransition) {
    // Each side of the reveal keeps its original opaque text/background pair.
    pendingTheme = target; root.dataset.themeMotion = 'snapshot';
    themeMotion = document.startViewTransition(commit);
    themeMotion.ready.catch(() => {});
    themeMotion.updateCallbackDone.catch(() => {});
    themeMotion.finished.catch(() => {}).finally(() => { if (version === themeVersion) { delete root.dataset.themeMotion; themeMotion = null; } });
  } else {
    root.dataset.themeMotion = 'instant';
    commit();
    // Resolve the new palette before restoring hover/focus transitions.
    root.getBoundingClientRect();
    delete root.dataset.themeMotion;
  }
}
export function settleAppearance() {
  ++themeVersion; themeMotion?.skipTransition(); themeMotion = null; pendingTheme = null;
  const [value, resolved] = snapshot().split(':');
  document.documentElement.dataset.appearance = value; document.documentElement.dataset.theme = resolved;
  delete document.documentElement.dataset.themeMotion;
}
function selectAppearance(choice) { memory = choice; try { localStorage.setItem(key, choice); } catch {} window.dispatchEvent(new Event('flowra-appearance')); }
function subscribe(listener) {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const update = event => { if (event?.type === 'storage') memory = undefined; apply(true); listener(); };
  window.addEventListener('flowra-appearance', update); window.addEventListener('storage', update); media.addEventListener('change', update);
  return () => { window.removeEventListener('flowra-appearance', update); window.removeEventListener('storage', update); media.removeEventListener('change', update); };
}
export function AppearanceSync() { useSyncExternalStore(subscribe, snapshot, () => 'system:light'); useEffect(() => apply(), []); return null; }
function Icon({ type }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{type === 'light' ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></> : type === 'dark' ? <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/> : type === 'system' ? <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></> : <><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/></>}</svg>;
}
export function AppearanceSelector() {
  const value = useSyncExternalStore(subscribe, snapshot, () => 'system:light').split(':')[0];
  return <fieldset className="appearance-selector"><legend>Appearance</legend><div>{choices.map(choice => <label key={choice} className={value === choice ? 'chosen' : ''}><input type="radio" name="appearance" value={choice} checked={value === choice} onChange={() => selectAppearance(choice)}/><Icon type={choice}/><span>{choice === 'contrast' ? 'High contrast' : choice[0].toUpperCase() + choice.slice(1)}</span><span className="appearance-check" aria-hidden="true">{value === choice ? '✓' : ''}</span></label>)}</div></fieldset>;
}

export function LoginAppearance() {
  const [open, setOpen] = useState(false);
  const preference = useSyncExternalStore(subscribe, snapshot, () => 'system:light').split(':')[0];
  const region = useRef(null), trigger = useRef(null); const id = useId();
  function close(returnFocus = false) { setOpen(false); if (returnFocus) trigger.current?.focus({ preventScroll: true }); }
  useEffect(() => {
    if (!open) return;
    region.current?.querySelector('input:checked')?.focus({ preventScroll: true });
    const outside = event => { if (!region.current?.contains(event.target)) setOpen(false); };
    const keyboard = event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus({ preventScroll: true }); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('focusin', outside); document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); document.removeEventListener('keydown', keyboard); };
  }, [open]);
  return <div className="login-theme" ref={region}>
    <div className="login-card-header"><span className="badge">Public demo workspace</span><button ref={trigger} className="appearance-trigger" type="button" aria-label="Appearance settings" title={`Appearance: ${preference === 'contrast' ? 'High contrast' : preference}`} aria-expanded={open} aria-controls={id} onClick={() => open ? close() : setOpen(true)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}><Icon type={preference}/><span className="sr-only">Choose appearance</span></button></div>
    <div id={id} className="login-appearance-reveal" data-open={open} aria-hidden={!open} inert={!open} role="region" aria-label="Login appearance choices"><div><AppearanceSelector/></div></div>
  </div>;
}
