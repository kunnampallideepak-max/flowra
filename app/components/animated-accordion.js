"use client";
import { useId, useState } from 'react';

export default function AnimatedAccordion({ title, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <section className="technical-accordion" data-open={open}>
    <h3><button id={`${id}-trigger`} aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen(value => !value)}>{title}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></h3>
    <div id={`${id}-body`} role="region" aria-labelledby={`${id}-trigger`} aria-hidden={!open} inert={!open} className="accordion-reveal"><div><div className="accordion-copy">{children}</div></div></div>
  </section>;
}
