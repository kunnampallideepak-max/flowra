"use client";
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
const steps = [
  ['See the whole water network', 'Flowra helps an operator watch water levels, spot unusual flow and compare fair distribution plans. Internal mode generates readings in this browser. Connected mode uses received synthetic HTTP frames. No physical water infrastructure is connected.', 'Start with Overview for the tank level, flow, alerts and zone delivery. Choose your source in Demo & settings.', 'overview'],
  ['Follow water from tank to zones', 'A source fills one 20,000-litre tank. Pipes carry water through three virtual valves to Zones A, B and C, serving 50 households. The digital twin is an interactive picture that follows the same simulation as the dashboard.', 'Open Digital twin, select a zone, then compare its inlet and delivered water.', 'network'],
  ['Read the sensor numbers', 'L means litres. L/min means litres per minute: 24 L/min is 24 litres passing a sensor each simulated minute. Inlet measures water entering a zone; outlet measures delivery to users. Flow imbalance is inlet minus outlet.', 'Compare inlet and outlet in Sensor inspection. All values have units.', 'network'],
  ['Understand a suspected leak', 'A large difference between inlet and outlet can suggest water loss. Flowra waits for three consecutive readings above its threshold before flagging a suspected leak. Persistent samples simply means repeated readings in a row. A warning is evidence to inspect, not a confirmed leak.', 'Choose Suspected leak. After about four seconds, expand the Zone B alert.', 'analysis'],
  ['Look ahead for shortages', 'Demand forecasting estimates future water needs from up to ten recent samples. The planning horizon is how far ahead we look: two simulated hours. A shortage is predicted when those needs exceed available water while keeping 2,000 litres in reserve.', 'Choose Limited supply and compare the forecast with the allocation budget.', 'allocation'],
  ['Share limited water fairly', 'Allocation optimization proposes how to share the budget. It gives each zone the same fraction of its need. Demand coverage of 60% means receiving 60 of every 100 litres needed. Unmet demand is the remaining 40 litres. The plan cannot create water or repair a leak.', 'Move a virtual valve slider, compare the preview with the fair proposal, then apply a virtual plan.', 'allocation'],
  ['Try all four scenarios', 'Normal operation shows balanced flow. Suspected leak adds loss in Zone B. Demand spike increases Zone C use. Limited supply starts with a low tank and less incoming water. Every scenario button resets to the same starting conditions.', 'Choose Internal simulation, then open Demo & settings and use Scenario studio. Return to Normal operation to clear active scenario alerts. Connected mode never fabricates scenario readings or sends hardware commands.', 'about']
];
const destinations = { overview: 'Overview', network: 'Digital twin', allocation: 'Allocation lab', analysis: 'Analysis & alerts', about: 'Demo & settings' };

export default function HowItWorks() {
  const [step, setStep] = useState(0);
  const [displayed, setDisplayed] = useState(0);
  const frame = useRef(null);
  const running = useRef([]);
  useEffect(() => () => running.current.forEach(animation => animation.cancel()), []);

  async function selectStep(index) {
    if (index === step) return;
    const container = frame.current;
    const height = container.getBoundingClientRect().height;
    running.current.forEach(animation => animation.cancel());
    const animations = [];
    running.current = animations;
    setStep(index);
    if (index === displayed || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(index);
      return;
    }
    const outgoing = container.children[displayed];
    const incoming = container.children[index];
    const nextHeight = incoming.getBoundingClientRect().height;
    const direction = index > displayed ? 1 : -1;
    function play(element, frames, duration) {
      const animation = element.animate(frames, { duration, easing: 'ease-out', fill: 'both' });
      animations.push(animation);
      return animation.finished;
    }
    function resize(from, to) {
      return play(container, [{ height: from + 'px' }, { height: to + 'px' }], 140);
    }
    try {
      // Make room before showing a taller article. A shorter one can enter while
      // the space below it contracts. Only one article is visible or focusable.
      const exit = play(outgoing, [{ opacity: 1 }, { opacity: 0, transform: 'translateX(' + -4 * direction + 'px)' }], 85);
      await Promise.all([exit, nextHeight > height ? resize(height, nextHeight) : undefined]);
      if (running.current !== animations) return;
      flushSync(() => setDisplayed(index));
      const enter = play(incoming, [{ opacity: 0, transform: 'translateX(' + 5 * direction + 'px)' }, { opacity: 1, transform: 'none' }], 145);
      await Promise.all([enter, nextHeight < height ? resize(height, nextHeight) : undefined]);
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    } finally {
      animations.forEach(animation => animation.cancel());
    }
  }

  return <section className="panel how-it-works" aria-labelledby="tour-heading">
    <div className="panel-head"><div><h2 id="tour-heading">How Flowra works</h2>
      <p>A short, practical introduction. You can explore at your own pace.</p></div>
      <span className="badge" role="status"><span>Step {displayed + 1} of {steps.length}</span>
        <span className="sr-only">. {steps[displayed][0]}</span></span>
    </div>
    <div className="tour-body">
      <div className="tour-toolbar">
        <div className="tour-steps" role="group" aria-label="Choose a learning step">
          {steps.map(([title], index) => <button key={title} type="button" onClick={() => selectStep(index)}
            aria-current={index === step ? 'step' : undefined} aria-label={`Step ${index + 1}: ${title}`}>{index + 1}</button>)}
        </div>
        <div className="tour-actions">
          <button className="button secondary" disabled={step === 0} onClick={() => selectStep(step - 1)}>Previous step</button>
          <button className="button primary" onClick={() => selectStep((step + 1) % steps.length)}>
            <span aria-hidden="true" className="tour-action-size">Restart introduction</span>
            <span>{step === steps.length - 1 ? 'Restart introduction' : 'Next step'}</span>
          </button>
        </div>
      </div>
      <div className="tour-frame" ref={frame}>
        {steps.map(([title, body, tip, target], index) =>
          <article key={title} className="tour-content" data-current={displayed === index} inert={displayed !== index} aria-hidden={displayed !== index}>
            <h3>{title}</h3><p>{body}</p>
            <div className="try-it"><strong>Try it yourself</strong><p>{tip}</p>
              <a href={'#' + target} className="button secondary">Open {destinations[target]}</a>
            </div>
          </article>)}
      </div>
    </div>
  </section>;
}
