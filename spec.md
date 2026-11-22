# Flowra — IDEA//FORGE Project Specification

## 1. Product and hackathon fit

- **Project name:** Flowra (do not append “AI” to the name).
- **Track:** Track 2 — Climate, Resource Infrastructure & Global Supply Resilience.
- **Closest organizer example:** Problem Statement 3 — Smart Grid & Urban Resource Allocation Controller.
- **Our problem statement:** Small community water-distribution operators may lack affordable, accessible tools for detecting abnormal flow, potential leaks, falling tank levels, and impending supply shortages, and for deciding how to allocate limited water fairly.
- **Goal:** A usable, attractive, reproducible software prototype for monitoring, detecting, understanding, and simulating decisions in a small water-distribution network.
- **Audience:** Community water operators, local authorities, and maintenance teams—not individual households as primary app users.

## 2. Deadline and scope

- Deadline in organizer document: **November 22, 2026, 11:59 PM IST**.
- Prioritize an end-to-end, publicly accessible working MVP over extra features.
- Do **not** imply any connection to a real utility network. **All sensor readings are simulated** unless real hardware is explicitly connected and tested.
- A working scenario-based simulation is more important than speculative, expansive features.

## 3. Technical stack

- Next.js App Router with **JavaScript** (not TypeScript) and Tailwind CSS.
- Recharts for simple time-series graphs (install only when needed).
- Responsive React/SVG network map; no need for an external mapping API.
- Deterministic JavaScript simulation engine with realistic, documented assumptions.
- Rule-based mass-balance and threshold checks for a transparent first anomaly detector; optionally supplement with a basic statistical approach if tested.
- Implement Gemini integration **server-side only** for plain-language explanations; it must actually call the API when a valid GEMINI_API_KEY is configured. When no key is configured, show an honest “AI explanation unavailable” state and a clearly labeled deterministic fallback; never use the generative model as the sole detector of leaks.
- Simulated ESP32 with Wokwi/MQTT/HTTP is **optional after MVP**. Do not delay submission for hardware integration.
- GitHub for source and Vercel or another supported host for a working deployment.

## 4. Main demonstration scenario

One central storage tank supplies three zones (A, B, C) representing approximately 50 households total. Show central tank level, source flow, zone inlet/outlet flow, recent trends, alerts, and a network diagram.

Demo controls:
1. **Normal operation** — readings within known tolerances.
2. **Suspected leak in Zone B** — simulated zone inflow exceeds measured zone outflow/legitimate consumption beyond a stated threshold for several readings. Flag a **suspected zone**, not an exact underground pipe coordinate.
3. **Demand spike** — unusually high consumption in a zone.
4. **Low tank / shortage** — limited water and forecast demand creates a potential shortfall.
5. **Operator simulation** — demonstrate virtual valve or allocation adjustments and show updated predicted outcomes. Virtual actions do not control real hardware.

Make scenarios reproducible via buttons; display all assumptions and simulation labels.

## 5. Core application pages/panels

- Dashboard overview: tank level, total flow, zones, status cards, alerts, trend chart.
- Network digital twin: interactive **illustrative** tank/pipes/sensors/zones, with colors indicating normal/warning/critical and click-to-inspect readings.
- Analysis: alert timeline, observed readings, rule/threshold that triggered each warning, uncertainty notes.
- Allocation simulator: current predicted demand vs available water; show a simple, explainable proposed allocation, unmet demand and comparison before/after.
- About/demo notes: transparently describe synthetic readings, algorithm limits, data assumptions and future hardware integration.

## 6. Definition of working AI

- Core detection must be explainable and independently testable even if the Gemini API is unavailable.
- Implement a Gemini server-side endpoint that turns actual measured simulation values, detected alerts, and documented assumptions into a concise explanation and recommended inspection steps when a valid key is configured.
- Model output must not invent facts, imply a confirmed leak, or suggest real-world autonomous shutdowns.
- If the Gemini API is not configured, show a clearly labeled rules-based explanation and indicate that generative explanation is unavailable. Never claim an AI call happened when it did not.

## 7. Engineering / security requirements

- Do not expose API keys in the browser, GitHub, logs, screenshots, or ChatGPT/Codex prompts. Store any private keys in `.env.local`, verify `.gitignore` ignores it, and use server-side route handlers.
- Keep dependencies minimal; avoid paid services and excessive complexity.
- Keep all pages responsive on mobile and desktop; accessible labels and readable contrast.
- No false real-time claims: if readings are generated locally, mark as “Live simulation”.
- No invented performance claims such as guaranteed leak-detection accuracy or exact location detection.
- Add clear setup and deployment instructions in README.md.

## 8. Features to deliver in a single Codex implementation request

**M1 — Foundation:** Next.js starts at localhost:3000; professional dashboard shell; cards and visible, clearly marked placeholder readings; simple network graphic.

**M2 — Live simulation:** A single data simulation module drives tank, flow, charts and digital twin; normal/leak/demand-spike/low-tank scenario controls change the same shared state. No disconnected random mock numbers.

**M3 — Detection and insight:** Persistent imbalance and threshold checks generate alerts with observed values and reasons; test normal vs leak scenarios to minimize false alerts.

**M4 — Resource allocation:** Simple explainable water allocation simulator responding to limited available supply and zone needs; show outcome and constraints; virtual valves only.

**M5 — AI explanation:** Implement and document a working server-side Gemini endpoint; when GEMINI_API_KEY is configured, the user can request explanations using actual displayed sensor values. Without it, display an honest fallback and an explicit configuration notice. Do not create a fake AI response.

**M6 — Polish and submit:** Automated/manual checks, mobile responsiveness, GitHub upload, public deployment, incognito test, recorded working demo and final hackathon submission.

**M7 — Optional enhancement ONLY if M1–M6 are working:** ESP32/Wokwi simulated IoT data input; clearly document connection to the app. Never call this real-world physical sensing. This optional item must not block the completed MVP.

## 9. Acceptance tests / demo checks

- App starts without errors and production build succeeds.
- Every visible metric that claims to be live comes from one consistent simulation state.
- Clicking “Suspected leak” changes readings, triggers a matching zone alert, and highlights the affected zone.
- Clicking “Normal” restores a normal condition and clears or resolves the active alert appropriately.
- Selecting “Low tank” updates allocation needs and estimated shortage using defined formulas.
- Alert details show which measurements caused it and state uncertainty.
- AI explanatory text (if enabled) reflects the numbers actually displayed.
- No API keys or other secrets appear in the public repo.
- Public deployed URL works from an incognito browser window.

## 10. Instructions for coding agent: ONE-SHOT BUILD REQUEST

- Read this full specification and any applicable AGENTS.md, inspect the existing Next.js project, and **implement the entire MVP (M1 through M6) in this single request**. Do not stop for permission between feature groups. You may internally sequence your coding steps; the human wants one completed delivery, not feature-by-feature approvals.
- Create actual working simulation logic; all metrics, visualizations, alerts, charts and scenario controls must draw from consistent app state. Do not produce disconnected static cards or decorative mock behavior.
- Choose a visually polished, distinctive, responsive, accessible UI. Do not overcomplicate architectural decisions. Avoid requiring a database, account registration, maps, external broker, paid APIs, real ESP32, or other physical hardware.
- Include a real server-side Gemini API route, using current official JavaScript SDK documentation or a documented API method; do not embed, generate or request a secret key in code. Explain where the user should put GEMINI_API_KEY in `.env.local`. The app must still boot and the deterministic core must still function without the key.
- If a feature cannot be fully implemented in one pass, keep the rest of the application working and document the limitation accurately. Do not imply unimplemented integrations are working. Optional Wokwi integration is not a blocker.
- Add a README.md with local setup, optional Gemini configuration, simulation assumptions, limitations and deployment steps. Keep the repository safe to publish; verify .env.local is gitignored.
- Write automated tests of the pure simulation / detection / allocation calculations using existing tools or a minimal appropriate test runner. Verify that normal, suspected leak and low-tank scenarios behave as stated.
- Run appropriate lint, automated tests and `npm run build` (on PowerShell use `npm.cmd` where needed). Fix all errors you can find. Never claim a successful test unless actually run. Do not suppress failing checks by removing tests.
- Finally, report what was implemented, which checks passed, any failures or missing external keys, how to run the website, and which parts are simulated. The goal is ONE complete usable deliverable, then the user will manually test all features.
