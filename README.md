# Flowra

Water infrastructure monitoring and fair distribution prototype for community operators. It supports an internal simulation and authenticated HTTP readings from a connected simulated ESP32. All demonstration readings are synthetic; virtual valve actions never control hardware.

## Run locally

Use Node.js 20.9+ (Node.js 22 LTS recommended) and npm. In Windows PowerShell use `npm.cmd`.

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://localhost:3000 and sign in with **operator** / **flowra2026**. This public, browser-tab demo login is not production authentication. The internal simulation works without a database, hardware, or Gemini credentials. If that port is occupied, use `npm.cmd run dev -- --port 3001`.

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd start
```

## Optional Gemini configuration

Copy `.env.example` to `.env.local`, set `GEMINI_API_KEY` locally, and restart Next.js. Never commit the private key or use a `NEXT_PUBLIC_` prefix. `.env.local` is gitignored; `.env.example` is intentionally publishable.

`GEMINI_MODEL` defaults to `gemini-flash-latest`; set it to a generateContent-compatible model available to your account. Model availability and quotas can change. On Analysis & alerts, click **Explain this snapshot**. The server validates a bounded numeric snapshot and sends its actual values, alert rules and forecast to Gemini. Responses are labeled with their snapshot minute while the live simulation can continue. Missing configuration, timeout, empty response or upstream errors produce an explicit **AI explanation unavailable** state and a deterministic fallback. The detector never depends on Gemini. No API key is sent to browser code or included in upstream error messages.

`GEMINI_TIMEOUT_MS` sets the server request deadline (1,000–120,000 ms; default 60,000). Hosting limits still apply; the route requests a 90-second execution budget where supported. The original 20-second deadline was reproduced during diagnosis, and a 60-second attempt also timed out before HTTP headers arrived. Metadata lookup authenticated successfully for `gemini-flash-latest` and reported `generateContent` support. An empty POST returned the expected validation error promptly. Those alias requests did not verify an answer, so their underlying generation delay remains unresolved; do not interpret a longer timeout as a verified service fix. No retries or model changes happen automatically.

Errors now include a stable `errorCode` and a specific safe message for missing/invalid keys, denied access, unknown models, quota/billing, rejected requests, provider outages, network/TLS errors, timeouts, blocked content and invalid/empty responses. `/api/explain` returns 504 for a timeout, 429 for upstream quota limits, 503 for missing configuration/service outages, or 502 for other upstream failures, alongside the existing labeled deterministic fallback. Previously all upstream failures appeared as HTTP 200 with one generic message; HTTP 200 now means a parsed Gemini answer succeeded. Invalid app input retains its existing 400/403/413 behavior.

Server logs use `[Flowra Gemini]` and allowlisted metadata only: key presence (boolean), validated model ID, timeout, elapsed time, upstream HTTP status, availability and a fixed error code. They do not log keys, prompts, conversations, generated text, raw errors or provider error bodies. Keep `.env.local` private and restart Next.js after configuration changes.

Safe local diagnostics (no credential or generated text is printed):

```powershell
node scripts/check-gemini.mjs
node scripts/check-gemini.mjs --check-post
# Optional: ONE real request using only synthetic simulation data; may consume quota.
node scripts/check-gemini.mjs --generate
```

The default diagnostic fetches model metadata without generating tokens. `--check-post` deliberately submits empty contents to check POST connectivity without generation. `--generate` explicitly invokes the existing application integration once, obeys the configured timeout and does not retry. A metadata success does not establish generation permissions, quota availability or generation latency.

The implementation uses the documented [Gemini generateContent REST method](https://ai.google.dev/api/generate-content) with `x-goog-api-key` in a server-only request header. The endpoint rejects cross-origin browser requests, limits input to 40 KB, whitelists numeric simulation fields and bounded conversational text, and enforces a best-effort 10 requests/minute per server instance. This prototype limit is not a distributed abuse-control service; configure host quotas before a large public launch. Gemini usage may have provider quota or billing requirements; it is optional.

## Included panels

- **Overview:** shared live tank/flow metrics, real time-series chart, alerts, forecast and zone coverage.
- **Digital twin:** a dedicated large network map with source, tank, directional pipes, normal/warning/critical states, selectable sensors and directly adjustable virtual valves. Overview uses a smaller, separate network preview.
- **Analysis & alerts:** live inlet/outlet measurements, persistent imbalance samples, expandable rule evidence, alert open/resolution timeline and Gemini snapshot explanations.
- **Allocation lab:** per-zone sliders, before/after water budgets, unmet demand, least-served-zone coverage, a fair allocation proposal and virtual application to the shared simulation.
- **Demo & settings:** data source, scenarios, pause/resume/reset, connected status, technical information and uncertainty.
- **Ask Flowra:** accessible question-and-answer interface, reached from contextual actions in Analysis & alerts, using the existing server-only Gemini integration. Suggested questions help beginners get started.
- **How Flowra works:** a seven-step interactive introduction, practical scenario instructions and expandable plain-English definitions of technical terms.
- Pause/resume and scenario reset are in Demo & settings. JSON snapshot export is available throughout. Hash navigation preserves the shared simulation and supports browser back/forward.

## Ask Flowra and snapshot context

Ask Flowra captures a numeric snapshot when the first question is sent. Every follow-up in that conversation uses the same snapshot, even while the live simulation advances or a scenario changes. The interface labels the frozen scenario and minute and warns when the live network differs. **Use latest snapshot** cancels an in-flight request, clears the conversation and captures current readings. Moving between Analysis and Ask Flowra preserves the same conversation.

The server grounds answers in validated zone readings, alert evidence, forecasts and allocation results. It includes up to four prior successful question/answer pairs from the same snapshot, with bounded question/history lengths and snapshot identity checks. User text is treated as untrusted. The model receives no control tools and cannot execute actions. The browser keeps at most 20 turns in memory; reload clears them. Full responses remain visible locally; previous model answers are limited to 1,800 characters each when passed as context.

With no key or an upstream failure, the interface says **AI response unavailable** and labels any deterministic text as a **rules-based snapshot summary, not a generated answer to your question**. A connection failure keeps the typed question for retry. The existing **Explain this snapshot** action remains available. A successful mocked test is not evidence of a real Gemini call; real service responses remain unverified unless explicitly tested with a configured key.

The sidebar contains only Flowra branding and useful navigation. It scrolls on short desktop displays; mobile navigation exposes text labels in a horizontal scroll region. Promotional content is removed. A functional demo profile and sign-out menu is available in the header; it does not claim a production identity. `devIndicators: false` hides the Next.js development badge without changing other Next configuration.

## Internal simulation assumptions and formulas

All readings are synthetic. No physical water hardware, real utility system, MQTT broker or geographic map is connected. Connected mode accepts only explicitly labeled synthetic ESP32 frames and does not infer physical sensing. Virtual valve actions have no real-world effect. The engine is deterministic (no random number calls).

- Tank capacity: 20,000 L; normal initial storage 15,600 L. Planning reserve: 2,000 L.
- Zones A/B/C contain 20/18/12 households, respectively (50 total).
- Demand: 1.2 L/min per household × `(1 + 0.045 × sin(minute / 6 + zoneIndex))`.
- Each two wall-clock seconds advances one simulated minute. Browsers may throttle background tabs; this is a simulation clock, not elapsed real time.
- Source: 68 L/min normally; 15 L/min in limited supply, which starts at 3,200 L.
- Leak scenario: Zone B loses an additional 12 L/min at 100% valve opening.
- Demand spike: Zone C demand × 2.2.
- Valve opening linearly scales legitimate delivery and leak flow. When tank plus incoming supply cannot satisfy requested distribution, flows scale proportionally. Tank stays between 0 and capacity; excess source becomes accounted overflow.
- Storage balance: `nextTank = clamp(tank + (source − sum(zoneInflows)) × 1 minute, 0, capacity)`.
- Zone mass balance: `inlet = legitimate outlet + loss`. Sensors are ideal and noise-free.
- Suspected leak: inlet minus outlet exceeds `max(3 L/min, 15% of inlet)` for 3 consecutive samples. This identifies a suspected zone, not an exact leak location.
- Unusual consumption: delivered consumption exceeds 160% of that zone's baseline. Low tank: below 20% capacity.
- Forecast: average up to ten recent underlying demand/loss samples over a 120-minute horizon. Budget = `max(0, tank − reserve) + source × 120`. Shortfall = `max(0, (meanDemand + meanLoss) × 120 − budget)`. Reserve time = `(tank − reserve) / (meanDemand + meanLoss − source)` when net drain is positive, floored at zero; otherwise not projected.
- Allocation previews use current zone demand, held constant for 120 minutes, so zone comparisons and valve settings are directly interpretable. Full-open losses are estimated from observed flow/opening; the known synthetic B leak coefficient is used when reopening a closed valve. This is explicitly available simulation knowledge, not hidden real-world sensing.
- Fair allocation maximizes minimum demand coverage: fraction = `min(1, budget / (totalDemand + estimatedFullOpenLoss) / 120)`. Each zone receives that same demand fraction. Compared with manually unequal valve settings this improves the least-served zone; it does not necessarily reduce total unmet demand. Percent valve proposals round down to avoid exceeding budget.

## Verification and demo walkthrough

1. Normal: let readings advance; no abnormal alerts should appear. Inspect tank and all zones.
2. Suspected leak: after three total samples (approximately four seconds from reset), Zone B highlights and an evidence-backed suspected leak opens. In Analysis, expand the alert to see inlet/outlet numbers and the persistence rule.
3. Normal: active alerts clear; prior alerts receive resolution timeline entries on reset. Timeline timestamps are scenario-relative; exported snapshots include the current scenario.
4. Demand spike: unusual consumption appears for C without a suspected-leak alert.
5. Limited supply: low tank alert, reserve depletion time and a nonzero two-hour shortfall appear.
6. Allocation: lower B to 10% in the preview, compare coverage with the fair proposal, load the fair plan, then apply virtual valves. Inspect changed distribution everywhere.
7. Analysis: request an explanation. Without a key, verify the explicit unavailable notice and calculation-based fallback. With a key, check the snapshot-minute evidence; the model remains advisory.
8. Pause/resume and export a JSON snapshot. Refresh to start a clean demo.
9. Open **How Flowra works** and move through the seven steps. Expand **L/min**, **Flow imbalance**, **Persistent samples**, **Planning horizon**, **Demand coverage** and **Unmet demand** definitions beside the relevant readings or allocation table.
10. Open **Ask Flowra**, send a question and then switch scenarios. Confirm the answer remains labeled with its frozen snapshot. Ask a follow-up, then choose **Use latest snapshot** to start a conversation about the new conditions. Without a key, confirm the unavailable label rather than a fabricated model answer.
11. In **Digital twin**, select Zone B or valve B, change the virtual opening and apply it. Compare delivered flow in Overview, sensor values in Analysis, and the allocation preview. All use the same underlying state.

`npm.cmd test` runs the pure engine and mocked Gemini transport tests. Mocked API tests do not verify a real Gemini account. Browser tests use Playwright with locally installed Chrome (see `playwright.config.mjs`):

The usability update was verified with 15 automated calculation/API tests, 9 Playwright browser tests, ESLint and a production build. Browser coverage includes all four scenarios, shared readings after valve changes, mocked assistant success and follow-ups, snapshot reset, missing-key and connection failures, guided learning, keyboard-operated definitions, and navigation/overflow at 1280×450, 768×600, 390×844 and 320×568. No real Gemini request was verified.

```powershell
npm.cmd run test:e2e
```

That command starts a production server on port 3100; run `npm.cmd run build` first. Set `PLAYWRIGHT_CHANNEL` to `msedge` for installed Edge. For CI, provision a browser and adjust the Playwright channel if needed. Tests cover scenario interactions, shared network readings, allocation, export, missing-key fallback, snapshot endpoint validation, console errors and narrow-screen overflow. The test server explicitly disables Gemini credentials so browser tests verify the missing-key fallback without consuming provider quota.

## Publish and submit

Use a Next.js Node runtime for the HTTP routes. Internal simulation, the demo login, alerts, exports, network selection, allocation previews and the rules-based explanation work without environment variables or a running ESP32 simulator.

1. Run `git status --short --untracked-files=all`. Stage the reviewed source, lockfile, assets, tests and documentation, then inspect `git diff --cached --name-only` before committing. Keep local environment files, configured firmware, device credentials, tools, browser traces and logs off GitHub.
2. For the public hackathon demo, import the reviewed commit into Vercel using the Next.js preset, or use a Node host with `npm ci`, `npm run build` and `npm start`. Start with Gemini and telemetry credentials unset. A reverse proxy that gives Next.js an internal URL should preserve the public Host header and set `FLOWRA_PUBLIC_ORIGIN` to the exact external origin, including HTTPS and any nondefault port.
3. Open the returned URL in a fresh incognito window and run the walkthrough above on desktop and mobile.
4. Record the walkthrough (normal → B leak → evidence → shortage → fair allocation → explanation) and submit the deployed URL, repository and recording through the hackathon portal before November 22, 2026, 11:59 PM IST.

GitHub upload, public deployment, public incognito verification, a recorded demo and final hackathon submission require the owner's accounts, repository destination and submission portal; these are not automatically completed by the source implementation. No public URL or hardware connection is claimed.

**Optional services.** `GEMINI_API_KEY` and `FLOWRA_INGEST_TOKEN` are separate server secrets. `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS` and `FLOWRA_DEVICE_ID` are optional configuration. Use server environment variables without a `NEXT_PUBLIC_` prefix. The public operator account only gates the interface in the browser. Before enabling public Gemini generation, set provider quota controls and enforce access or a request budget across instances. The local limiter allows ten valid explanation requests per minute per process.

**Connected demonstrations.** Use the documented local Wokwi receiver for the ESP32 walkthrough. Readings, replay checks, freshness history and frozen connected snapshots share process memory. Restarts lose that state and separate serverless instances have independent buffers. Reliable hosted ingestion requires shared storage with atomic validation or a deliberately single-instance receiver with an understood restart policy. All readings in both modes are synthetic.

## Limits

This is a prototype, not a hydraulic engineering or utility control system. Pressure, elevation, pipe friction, sensor uncertainty and transit delays are not modeled. A leak alert can also represent meter faults or unmetered use in a real system. Forecasts have no calibrated confidence interval and assume unchanged conditions. State is memory-only per browser tab, with a bounded 90-sample chart and 100-event timeline; use export to retain a snapshot. The local Wokwi ESP32 delivered normal readings to Flowra. See [the recorded receiver timestamps](hardware/wokwi-esp32/README.md). Real Gemini service behavior cannot be verified without a configured key; unit tests exercise the documented transport through mocks.

## Verified pinned-model follow-up

A single bounded generateContent test against `gemini-3.5-flash-lite` returned HTTP 200, nonempty real text and STOP in approximately 1.6 seconds (15-second deadline; 64 output tokens; tiny synthetic tank prompt). Official metadata lists this exact model with generateContent support for the configured key; official pricing lists free-tier text input/output. Metadata does not expose project-specific remaining quota. `.env.local` now pins this verified model through GEMINI_MODEL without changing the key, billing or timeout. The application omits an explicit sampling override for this pinned model to match the verified request profile.

Exactly one alternative generation request was made, with no retries. A second live full Ask Flowra request was not made because of the one-request cap. Restart Next.js and send one short Ask Flowra question to verify the complete app path. Its grounded request and response parsing are covered by mocked tests; that is separate from the real tiny-prompt success. The latest alias metadata identifies itself as Gemini Flash Latest but supplies no concrete version, so its exact current backend was not established from metadata.

## Complete demo: sign-in, sources and device input

- **Sign in:** `operator` / `flowra2026`. Incorrect credentials show an error. The tab session survives reload. Use the header operator icon to view the demo profile or sign out. This is intentionally client-side demo access, not a backend authorization boundary.
- **Internal simulation:** default mode, with all four original scenarios, charts, detection, forecasting and virtual valve application preserved.
- **Connected device:** displays only complete received HTTP frames; no internal readings fill missing data. If no frames exist, the dashboard displays an empty state. A source label and received/measured timestamps identify every feed. Last values become explicitly historical after 15 seconds, and disconnected after 45 seconds. Poll failures never masquerade as live data.
- **Virtual controls:** application is disabled in connected mode; allocation sliders can preview only. No endpoint controls a device. Switch back to Internal simulation to apply virtual valves.
- **Ask Flowra:** preserves frozen snapshots and follow-up context, now including source identity and server-recorded connected frames. Bold text, headings, lists and inline code render through a safe React Markdown subset; HTML is never executed. A small evidence panel exposes the frozen tank value for comparison. Gemini and rules-based summaries remain distinctly labeled. No new real Gemini quota was consumed during this implementation.

Detailed ingestion contract and exact local sender commands: [docs/telemetry.md](docs/telemetry.md). ESP32 sketch, configuration and gateway/HTTPS bridge instructions: [hardware/wokwi-esp32/README.md](hardware/wokwi-esp32/README.md).

Example local walkthrough (after starting Next.js and selecting Connected device):

```powershell
node scripts/send-telemetry.mjs --scenario=leak --count=6
```

The sender privately loads the separate device token from `.env.local`, uses real HTTP and prints only acceptance status. It is a Node test sender, not proof of a Wokwi run. This workspace has a locally generated ingestion token if none existed; its value was never printed or committed. For a fresh checkout, configure FLOWRA_INGEST_TOKEN (at least 32 random characters) and FLOWRA_DEVICE_ID, then restart Next.js. See .env.example. Never put device tokens in browser code, public Wokwi source or Git.

Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, then `npm.cmd run test:e2e`. Browser tests use public demo credentials and a test-only device token, and disable Gemini credentials so no Google requests occur. Coverage includes original scenarios and panels, login/profile/sign-out, validated HTTP ingestion, source switching, safe Markdown, frozen context, and disconnected/stale states.

Before production: replace public demo access with real authentication and authorization, protect read APIs and Gemini spending, provision durable multi-instance telemetry storage, use TLS and per-device rotating credentials, add monitoring/audit/edge rate limits, and validate real sensor calibration. The current telemetry store is a single-process local-demo buffer, not a production IoT backend. No deployment, tunnel, account change or GitHub upload was performed.

Final checks for this extension: 29 automated unit/calculation/validation tests and 14 Playwright browser tests passed, together with ESLint and the production build. The actual local Node sender delivered three HTTP 202 frames and produced the expected Zone B suspected-leak evidence; the stopped feed became disconnected without adding samples. A browser-bundle scan found neither private server credential in shipped JavaScript. That test used the Node sender. The later Wokwi verification is recorded in the hardware walkthrough.

## Appearance and visual verification

Choose the compact **Appearance settings** icon inside the sign-in card header, or open **Operator profile** in the dashboard header. Select **Light**, **Dark**, **System**, or **High contrast**. System follows live operating-system colour changes. The browser remembers the preference across reloads, sign-out and future visits; it is independent of the demo session. If browser storage is blocked, the preference lasts only for the current page session. A small trusted startup script applies the stored appearance before the page renders; no theme dependency or external service is used.

The source selector is a spaced segmented control. Connected-device details use labeled cards, retain genuine timestamps and sender identity, and distinguish current, stale and historical data. Profile controls support Tab, Enter/Space, Arrow Down to open, Escape to close, outside click, and focus return after the profile dialog. Appearance choices are native radio buttons, including keyboard arrow-key selection. Form fields have explicit labels, stronger borders, validation and a Show/Hide password control.

All pages, dropdowns, dialog, SVG network, flow chart axes/grid/tooltips and status colours use shared CSS variables. High contrast strengthens borders and focus indicators. Status text accompanies colour. Motion is disabled when the browser requests reduced motion. Tank labels have a stable background so changing water height cannot reduce their contrast.

Verification commands:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

Appearance tests capture screenshots under `test-results/appearance/` (gitignored), including light/dark login and overview, dark Digital twin and Ask Flowra, low tank, connected status, profile menus, high contrast and mobile. Tests cover live System changes, persistence, login validation/password visibility, profile keyboard access, source selection, freshness states and all pages at 320, 390 and 768 px. Existing tests retain the four scenarios, virtual valves, exports, ingestion validation and mocked Gemini behavior. The test server disables Gemini keys; appearance tests never request a generated answer. Semantic text/action palettes have automated AA contrast checks; these are not a full accessibility certification.

Manual check: select each appearance, reload, sign in with `operator` / `flowra2026`, open the operator menu, inspect all pages, try the four scenarios, inspect tank/zone labels in the twin and toggle Connected device. With a local sender running, check the received timestamp; stop it to see Stale after 15 seconds and Disconnected after 45 seconds. Switch back to Internal simulation. In System mode, change the OS appearance while the app remains open. Use Tab and Escape and test a narrow browser window. Server telemetry, demo-auth and physical-hardware limitations described above remain unchanged.

Final appearance verification: **32 unit/integration tests**, **17 Playwright browser tests**, ESLint, production build and `git diff --check` passed. Fifteen appearance screenshots were captured and visually reviewed. Review led to fixes for dark tank-label contrast, preserved critical tank outlines, dark alert-count badges and desktop navigation spacing. No real Gemini request, secret change, deployment or GitHub upload was made.

## Workspace controls and refresh behavior

Open the final sidebar destination, **Demo & settings**, to select Internal simulation or Connected device, run all four scenarios, Pause/Resume, or **Reset current scenario**. Operational pages keep only export and a short synthetic-data disclosure; the sidebar provides access to these controls. The top status reads Demo running / Demo paused, or Device connected / Stale / Disconnected. The detailed device identity, genuine received/measured timestamps and setup instructions are in settings. Navigation does not reset the selected source or scenario.

Reset restores the selected internal scenario and valve openings, retaining appearance, session, source, conversation and bounded alert history. It preserves the paused/running choice. In connected mode, pause and reset are disabled: Flowra cannot stop an external sender or manufacture its data. Switch back to Internal simulation to restore its retained state.

Refresh now starts in an explicit **Checking demo session** state. Both the server and the first hydrated render show a minimal Flowra loading view; the sign-in form appears only after checking browser session storage. A signed-in refresh retains its hash destination without redirects. This remains public client-side demo authentication, not production security. Internal simulation still intentionally resets on a full reload; source selection and assistant conversation remain in-memory as documented above.

The profile dropdown no longer unmounts when a native appearance label receives focus. Appearance changes apply immediately, persist when localStorage is available, and follow live OS changes in System mode. Try clicking the visible Light/Dark/System/High contrast text, not only the radio circle. Profile label: hover the compact OP button with a mouse or focus it with the keyboard to expand its inline label; click to open the menu. No floating tooltip is used. Reduced motion disables transitions; on touch, tap opens the menu directly.

Successful answers are branded **Flowra Assistant** with **AI-generated response**. Failed or missing-provider requests show **AI response unavailable** and an explicit rules-based summary label; they never claim to answer the question through a model. Gemini remains the server-side provider, documented in technical information. The Markdown subset supports paragraphs, headings, lists, nested emphasis, inline/fenced code and blockquotes. HTML is always escaped rather than executed. Unsupported advanced Markdown is displayed as text. Frozen snapshots and follow-up history are preserved. A concise-answer instruction discourages repeated greetings without rewriting generated evidence.

Manual verification:

1. Run `npm.cmd run dev`, open localhost:3000 and sign in using `operator` / `flowra2026`.
2. Open Digital twin, refresh, and confirm a brief branded initialization view may appear but the login form does not flash. The destination stays Digital twin.
3. Open OP, click each appearance label, refresh, and check persistence. Choose System and change the OS colour preference. Tab/arrow keys and Escape should also work.
4. Open Demo & settings, pause and choose each scenario. Navigate to Overview, Digital twin, Analysis and Allocation to inspect the same network. Reset the current scenario and confirm appearance and session remain unchanged.
5. Select Connected device. Confirm simulation controls are disabled. With a configured token, run `node scripts/send-telemetry.mjs --scenario=leak --count=6`. Check settings timestamps and received status, then inspect zone readings. After the sender stops, expect Stale after 15 seconds and Disconnected after 45 seconds. Without any received frame, operational pages show an empty state.
6. Ask one question only if you wish to consume provider quota; compare numerical evidence with the frozen snapshot. Follow-ups stay frozen until Use latest snapshot. No actual model requests are made by the automated browser suite.
7. Test at desktop, tablet and 390/320 px widths. Screenshots from the workspace-polish suite are in `test-results/polish/`; appearance coverage remains in `test-results/appearance/`.

Workspace-polish verification: 32 unit/integration tests, the full 23-test Playwright suite, ESLint and the production build passed. After the final connected-source footer and input-modality fixes, all 9 focused assistant/profile/telemetry browser checks passed again. Light/dark desktop and mobile screenshots were captured and visually inspected, including the corrected touch screenshot. The tooltip follow-up was necessary because touch focus could otherwise leave a delayed tooltip after dismissal; touch now suppresses it, while subsequent keyboard input restores focus support. No real Gemini requests, deployment, secret changes or GitHub upload occurred.

Diagnosed causes: the demo session's server snapshot previously returned signed-out before browser storage was checked; profile blur handling could remove native appearance inputs during label activation; the Markdown renderer only recognized simple single-line bold text. Session initialization now uses a checked/unchecked distinction, focus handling preserves label activation, and the bounded renderer handles grouped paragraphs, nested emphasis and unfinished formatting safely. Unsupported advanced Markdown remains plain text.

## Networks pilot and final product polish

The Networks destination provides dependent State ? District ? Town/locality selectors, six officially sourced example places and three explicitly illustrative one-reservoir templates. No real pipeline records were obtained. Network selection preserves separate browser-memory simulation states and never reassociates connected telemetry. A permission-gated JSON reviewer validates a local file without uploading it or certifying its provenance.

The compact OP avatar now reveals its inline label on hover or keyboard focus, with a stable header slot and reduced-motion support. Touch opens the existing menu directly. Navigation uses a short fade without remounting the engine. Typography, chart labels and schematic layouts have been refined across all appearances. Flowra's original droplet favicon and Water Intelligence title replace default branding.

See [Networks pilot documentation](docs/networks.md) for supported locations, official source links, topology assumptions, connected-device safeguards, import schema and icon regeneration instructions. The earlier floating-profile-tooltip description is superseded by the inline expanding avatar.

Verification for this update: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` and `npm.cmd run test:e2e`. Browser tests cover the pilot hierarchy, distinct diagrams, isolated simulation state, unchanged connected mapping, local import, metadata, hover/focus/touch behavior, themes and responsive layouts. No live Gemini request is needed for these checks.


## Final interaction refinement

Sign-out removes the browser demo session and unmounts the dashboard synchronously. A neutral Flowra veil fades away over 240 ms as the login page appears; no authenticated DOM is retained for an exit animation. Reduced-motion sign-out skips the veil. Sign-in uses the same short entrance fade, and signed-in refresh still uses the branded session-check state without mounting the sign-in form. This remains public demo access, not production security.

The OP interaction now has a fixed 176 x 44 px hit area with a stationary avatar. Only its visual surface expands from 44 to 176 px over 240 ms, while the label fades/slides in. Entering the label region cannot repeatedly change the hit boundary. The open menu holds the expanded desktop appearance even when focus moves inside it. Touch uses tapping without a hover dependency. Older positional span rules and a full-button hover background were removed so the avatar and animated surface remain consistent on mobile.

Demo & settings is ordered as source, scenarios, simulation controls, device status/setup, then technical information. Five expandable sections retain simulation assumptions, detection/forecast methods, data limitations, hardware boundaries and AI limitations. Essential synthetic-data and no-hardware disclosures remain visible. The repeated controls links and promotional card were removed. A shared 18 px major-card, 12 px inner-control and 10 px button radius scale softens the interface without changing calculation logic.

Ask Flowra has one conversation interface on its dedicated page. Analysis retains Explain this snapshot and adds compact contextual actions. Opening an alert captures its evidence and prefills a question without calling Gemini. An existing different frozen conversation is preserved; **Use alert snapshot** explicitly starts a fresh conversation, while **Keep frozen conversation** continues the original context. Ordinary navigation preserves the same conversation.

Regression commands remain `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:e2e`. The new `tests/browser/final-ux.spec.mjs` records actual Chromium animation frame progression (not just end-state screenshots), checks synchronous session invalidation, rapid pointer crossings, keyboard/reduced-motion behavior, duplicate removal, evidence handoff and responsive screenshots. Trace files and numeric frame samples accompany those tests; no extra video or animation dependency is required. Light/dark screenshots are under `test-results/final-ux/` (gitignored).

Manual walkthrough:

1. Start with `npm.cmd run dev`, sign in as `operator` / `flowra2026`, and refresh Digital twin: the sign-in form must not flash.
2. Move across OP and its label area rapidly. The avatar stays fixed, the label reveals to its right, and opening/moving into the menu keeps it expanded. Tab/Enter/Escape and touch tapping must work.
3. Change appearance, sign out, and confirm the smooth neutral reveal of login. Refresh: the session stays signed out and appearance persists. Enable reduced motion: session changes happen without motion.
4. Open Demo & settings. Test all four scenarios, pause/resume/reset, connected mode and its genuine status. Expand the five technical sections; no assumptions or limitations were discarded.
5. In Analysis, expand an alert and choose **Ask Flowra about this alert**. Inspect the captured snapshot and prefilled question. With an existing conversation and different evidence, explicitly choose which snapshot to use. Sending a question may consume Gemini quota; navigation alone never calls it.
6. Compare desktop and 390/320 px mobile layouts in Light, Dark, System and High contrast. Synthetic labels, telemetry boundaries, exports and all original operational features remain available.


Final refinement verification: **38 unit/integration tests**, **32 Playwright tests**, ESLint (no warnings), production build and `git diff --check` passed. Light/dark desktop and mobile screenshots were visually inspected. Actual Chromium screencast frames and requestAnimationFrame width/opacity samples were reviewed for the profile and session transitions; screenshots alone were not used to assess motion. Existing high-contrast, live System preference, source freshness, validated HTTP ingestion, four scenarios, allocation, network isolation, exports and Gemini mock/fallback regressions passed. No real Gemini generation request was made.

Files modified for this refinement: `app/page.js`, `app/globals.css`, `app/components/demo-access.js`, `app/components/data-source.js`, `app/components/ask-flowra.js`, new `app/components/demo-notes.js`, `tests/browser/dashboard.spec.mjs`, `tests/browser/improvements.spec.mjs`, `tests/browser/polish.spec.mjs`, new `tests/browser/final-ux.spec.mjs`, and `README.md`. No engine equations, provider transport, ingestion contract, dependencies or secrets were changed. Nothing was deployed or uploaded.


## Integrated appearance and firmware verification

The login card now contains an accessible icon trigger for Light, Dark, System and High contrast. Its choices expand in the card flow, moving the form below rather than floating over inputs. Arrow Down opens and focuses the selected option; native radio keys select a mode; Escape returns focus; outside click/focus closes it. The login action is **Sign in**. Demo credentials and the public-demo security disclosure remain visible; no registration was added.

Light/dark colour changes use a 240 ms browser View Transition crossfade between complete colour-paired scenes. This avoids interpolating text and card backgrounds independently, or tweening charts and numeric readings. Unsupported browsers apply the palette atomically with a subtle scene fade. Initial theme application, high contrast and reduced motion use immediate palette changes. System still follows OS changes and preferences persist. Pending appearance snapshots are cancelled before sign-out so an old dashboard scene cannot reappear.

All five technical information sections now use accessible animated accordions, with 240 ms natural-height grid expansion/collapse, coordinated opacity and chevrons, unique ARIA relationships and inert/hidden closed content. No fixed paragraph height is used. Reduced motion switches states immediately.

**ESP32 firmware compiled successfully** with the actual Xtensa compiler / Arduino-ESP32 framework, including both safe placeholder and private disposable-header paths. An old PlatformIO source filter excluded the converted sketch.ino.cpp; this was fixed and the Espressif32 platform pinned to 6.12.0. The firmware adds bounded WiFi recovery, safe HTTP diagnostics, response-aware backoff, stop/resume serial controls and storage-limited synthetic delivery. The endpoint schema, authentication, replay checks and rate limits were not weakened.

The optional `scripts/wokwi-demo.mjs` prepares a private disposable device credential and starts a loopback-only port-3002 production server, with Gemini disabled only in that test process. It never edits .env.local or prints the credential. Existing private configuration is not overwritten. Stop its server before cleanup and rebuild whenever credentials change. A three-frame Node test on this receiver returned 202, produced the correct B suspicion, then became Stale/Disconnected without new readings. This is still **not a Wokwi transmission**.

On 21 November 2026 the ESP32 running in Wokwi for VS Code delivered accepted frames through the bundled private gateway. The firmware now synchronizes its clock from the local receiver before generating each sample.

Follow [the Windows 11 Wokwi walkthrough](hardware/wokwi-esp32/README.md) for tool installation, private preparation, compile commands, license/config selection, serial commands, normal/leak verification and cleanup. [The telemetry contract](docs/telemetry.md) documents the unchanged ingestion validation and the Node fallback. Source-labelled synthetic readings never claim physical sensors.


Final checks for this update: **42 unit/integration tests**, the full **37-test Playwright suite**, ESLint and the production build passed. The five focused appearance-motion tests passed again after correcting screenshot scroll positioning. Login and technical-panel screenshots were visually inspected on desktop and mobile in light/dark; browser traces and frame measurements verify real theme opacity and accordion height transitions, keyboard/touch dismissal and reduced-motion behavior. Firmware compilation passed with Espressif32 6.12.0 / Xtensa GCC 8.4.0; the final placeholder image is 930,013 bytes with 47,284 bytes static RAM usage. That earlier test stopped its disposable receiver. The later live Wokwi run is recorded in the hardware walkthrough.

Updated files: `app/components/appearance.js`, `demo-access.js`, `demo-notes.js`, new `animated-accordion.js`, `app/globals.css`, `.gitignore`, `eslint.config.mjs`, the hardware sketch/configuration/README and new `telemetry_payload.h`, new `scripts/wokwi-demo.mjs`, new `tests/firmware.test.mjs`, new `tests/browser/appearance-motion.spec.mjs`, existing browser sign-in/accordion selectors, `docs/telemetry.md` and this README. Core simulation, detection, forecasting, allocation, provider request code and ingestion validation remain unchanged.
