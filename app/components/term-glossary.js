"use client";
import { useEffect, useId, useRef, useState } from 'react';

export default function TermGlossary({ terms, label }) {
  const group = useRef(null);
  const prefix = useId();
  const [active, setActive] = useState(null);
  const pinned = useRef(null);

  function close() {
    pinned.current = null;
    setActive(null);
  }
  useEffect(() => {
    if (active === null) return;
    const outside = event => { if (!group.current.contains(event.target)) close(); };
    const escape = event => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [active]);

  function preview(index) {
    if (pinned.current !== index) pinned.current = null;
    setActive(index);
  }
  function reveal(id) {
    const definition = document.getElementById(id);
    if (definition.getBoundingClientRect().bottom > document.documentElement.clientHeight) {
      definition.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  return <div ref={group} className="context-help" role="group" aria-label={label} data-reading={active !== null}
    onPointerLeave={event => {
      if (event.pointerType !== 'mouse' || pinned.current !== null || active === null) return;
      const focused = [...group.current.querySelectorAll('.term-trigger')].findIndex(button => button.matches(':focus-visible'));
      setActive(focused < 0 ? null : focused);
    }}>
    <p className="term-prompt" aria-hidden="true">Choose a term to read its definition.</p>
    {terms.map(([name, description], index) => {
      const id = prefix + '-' + index;
      const open = active === index;
      return <div className="term-help" key={name} style={{ '--term-column': index + 1 }}>
        <button type="button" className="term-trigger" aria-expanded={open} aria-controls={id} aria-describedby={id}
          onPointerEnter={event => { if (event.pointerType === 'mouse') preview(index); }}
          onFocus={event => { if (event.currentTarget.matches(':focus-visible')) { preview(index); reveal(id); } }}
          onClick={() => {
            if (pinned.current === index) close();
            else { pinned.current = index; setActive(index); reveal(id); }
          }}>
          <span>{name}</span>
          <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="10" cy="10" r="8"/><path d="M10 9v5"/><circle cx="10" cy="6.25" r="1" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        <div className="term-layer" role="tooltip" id={id} aria-hidden={!open} data-open={open}><p>{description}</p></div>
      </div>;
    })}
  </div>;
}
