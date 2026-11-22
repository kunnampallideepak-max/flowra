# Networks pilot and data integrity

## Supported places

This is a locally cached, manually curated pilot reviewed on **21 November 2026**, not a nationwide location directory or pipe map. IDs in `lib/networks.mjs` are Flowra application IDs, never LGD, Census or utility identifiers.

| State | District | Town/locality examples | Official relationship source |
| --- | --- | --- | --- |
| Kerala | Ernakulam | Aluva, Angamaly | [State Election Commission municipality list](https://www.sec.kerala.gov.in/public/ps/lb/da39a3ee5e6b4b0d3255bfef95601890afd8/U/M) |
| Karnataka | Mysuru | Nanjangud, Hunsur | [District municipality directory](https://mysore.nic.in/en/public-utility-category/municipality/) |
| Maharashtra | Pune | Baramati, Lonavala | [District Nagarpalika branch](https://pune.gov.in/en/nagarpalika-branch/) |

Only names and parent relationships were retained. No officials' personal/contact details were copied. These official references establish location context; they supply **no water-infrastructure evidence**. Administrative names may change; review the cache before expanding it.

[LGD](https://lgdirectory.gov.in/) is the national authoritative administrative directory and links to directory downloads and NAPIX services. A dependable unauthenticated national API was not established for this task. Flowra therefore makes one request to its own `/api/locations` cache, checks the returned hierarchy, and provides loading, timeout, retry, disabled dependent controls and an empty verified-network state. It never silently substitutes invented names when loading fails.

## Illustrative configurations

Each locality can be explicitly assigned one of three Flowra-authored templates:

- **Three-zone baseline:** the original manifold diagram.
- **Residential fan:** three radial terminal branches below the reservoir.
- **Community trunk:** a shared trunk and staged forks feeding three terminal zones.

All have **one 20,000 L tank, three zones, 50 modeled households, eight logical sensors and three virtual valves**. Two sensors describe tank level/source flow; six describe zone inlet/outlet flow. Junctions have no storage or modeled losses. The unchanged engine conserves water and scales zone flows through virtual valves; it does not model pressure, friction, distances or geographical routes. No multi-tank simulation is displayed.

“Illustrative network assigned to [place]” means a deliberately chosen conceptual template, not a discovered or verified utility layout. The catalog and full digital twin expose the assignment and lack of utility verification. The diagrams use schematic SVG positions, never geographic coordinates.

Selecting dropdown values only changes the browsing draft. **Open this network in Digital twin** activates a separate simulation namespace. Browser memory retains the last state and valve preview for each visited network; only the active internal simulation advances. Pause/running choice and source mode are preserved. Returning to the default restores its own state. Hash navigation preserves the catalog selection and operating state. Full reload clears this browser-only bank.

Snapshot exports include network identity, template, location context, source reference, verification label and sensor namespace. Logical A/B/C sensor readings are interpreted within that namespace. Server-validated snapshot and conversation keys include custom network identity; unrelated network IDs cannot be used as follow-up evidence. Explicitly changing networks starts a fresh Ask Flowra conversation, as explained before activation. Ordinary page navigation preserves the conversation.

## Connected devices

Only **flowra-default**, the original synthetic network, has the existing authenticated telemetry schema/mapping. That mapping has no geographic utility association. The ingestion API, token, device ID, freshness checks and server buffer remain unchanged.

Activating a pilot-place network does **not** reassociate a device, stop ingestion, change source mode or populate synthetic connected readings. Connected mode instead shows **No connected telemetry for this network** and disables export of nonexistent readings. Settings suppress the unrelated default feed. Opening the default network restores the original received stream. New device/network mappings require a separately validated server-side contract; a location selection cannot create one.

## Local JSON review (not a verification service)

No authoritative utility GIS or actual pipeline data was supplied or obtained. The Verified utility networks view is therefore an honest empty state.

An optional browser-only read-only review accepts JSON after the operator confirms permission to view it. Files are never uploaded, published, logged, persisted to localStorage or connected to simulation/control actions. Use **Clear local review** or reload to clear the displayed result. The maximum file size is 50 KB.

See [network-import.example.json](network-import.example.json), a **fictional test fixture**, not a real utility record or evidence that its example URL exists.

The schema requires exactly:

- `schemaVersion: 1`, a bounded `name`, `provenance`, `nodes`, `edges`, `sensors`.
- Provenance: `publisher`, an HTTPS `sourceUrl` without embedded credentials/query/hash, `permission` (`public-license` or `owner-authorized`) and a `licenseReference`.
- Nodes: unique bounded alphanumeric/hyphen `id` and `kind` (`source`, `reservoir`, `junction`, `valve`, `zone`). Maximum 32; exactly one source and one reservoir.
- Edges: `from` and `to`, forming one connected acyclic directed tree. Zones must be leaves downstream of the reservoir. Unknown nodes, duplicate incoming edges and disconnected/cyclic records are rejected.
- Sensors: unique `id`, known `nodeId` and `kind` (`flow` or `level`). Level sensors must belong to the reservoir. Maximum 64 identifiers; no measured values accepted.

Unknown fields are rejected, including credentials and arbitrary control/telemetry data. Text is safely rendered by React. Provenance and permission remain **operator declarations**, not proof; the result always says **Unverified import / read-only**. No import can mark itself utility-verified, switch the active engine or create a connected mapping. The review lists connections for human inspection; it is not a GIS map or hydraulic simulation.

Before a real utility integration, independently verify the publisher, provenance reference, licensing/permission and topology with an authorised utility representative, review sensitive records privately, add durable approved mappings, and validate hydraulic assumptions. GeoJSON, pressure modeling, national coverage and automatic provenance certification are outside this pilot.

## Visual behavior and testing

The OP button occupies a stable reserved header slot. Its visible width animates from 44 to 176 px over 220 ms on mouse hover or keyboard focus; label opacity/translation coordinate with the width change. Pointer departure collapses it. Touch uses direct tapping, with no hover requirement. The dropdown remains accessible via click, Enter/Space and Arrow Down, closes with Escape/outside dismissal, and returns focus. There is no floating tooltip. Closing/opening uses a short inert/ARIA-aware CSS transition rather than losing active controls mid-click.

Page content uses a 180 ms fade with 6 px upward motion on a persistent container, without delaying hash navigation or remounting the engine. Navigation links retain focus; actions that replace their own page move focus to its heading. Reduced-motion preference disables both page motion and control transitions.

Typography uses a reliable local system stack (Segoe UI on Windows, platform sans-serif elsewhere), avoiding font downloads and build network dependencies. The existing Arial Flowra wordmark is preserved. Primary body copy is approximately 16 px, secondary labels 13–15 px, with tabular measurement numerals and theme-aware chart labels.

Icons use App Router conventions: `app/favicon.ico` embeds 16/32 px PNGs, `app/icon.svg` supplies a scalable mint droplet, and `app/apple-icon.png` supports Apple touch icons. Regenerate with `node scripts/generate-icons.mjs` using Next's existing sharp dependency. `/flowra-16.png` and `/flowra-32.png` provide exact-size inspection previews. Browser title: **Flowra | Water Intelligence**. If an old icon remains cached, restart Next, open a fresh tab/incognito window and inspect `/icon.svg` and `/favicon.ico` directly.

Files added or updated for this enhancement:

- `app/page.js`, `app/globals.css`, `app/layout.js`: workspace integration, navigation motion, typography, appearance-aware styling and product metadata.
- `app/components/demo-access.js`: expanding inline profile control and persistent accessible dropdown.
- `app/components/networks.js`, `network-diagram.js`, `network-import.js`, `network.js`: catalog, distinct interactive diagrams, local review and digital-twin integration.
- `app/components/ask-flowra.js`, `lib/snapshot.mjs`, `lib/explanation.mjs`: network-scoped evidence and conversation isolation; provider transport unchanged.
- `lib/networks.mjs`, `lib/network-import.mjs`, `app/api/locations/route.js`: validated pilot catalog and local topology validation.
- `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`, `public/flowra-16.png`, `public/flowra-32.png`, `scripts/generate-icons.mjs`: original product icons and reproducible generation.
- `tests/networks.test.mjs`, `tests/browser/networks.spec.mjs`, `tests/browser/polish.spec.mjs`: regression coverage and screenshots.
- `README.md`, this guide and `docs/network-import.example.json`: setup, limitations and fictional import fixture.

Final verification: 38 unit/integration tests and all 28 Playwright tests passed, along with ESLint and the production build. An additional focused five-test Networks run captured the residential layout. Screenshots were inspected at desktop, tablet and mobile widths in light, dark and high contrast. System preference tracking is covered by the existing browser regression suite. No real Gemini generation, remote deployment or GitHub upload was performed.
