# Flowra: connected simulated ESP32

The ESP32 firmware runs in Wokwi and generates **synthetic** tank and flow readings. The private Wokwi gateway delivers authenticated HTTP frames to the Flowra receiver on your computer. Open **http://127.0.0.1:3002** to see them as **Connected simulated ESP32**. The [public Vercel demo](https://flowra-mu.vercel.app/) runs the browser’s internal simulation and has a separate data source.

## Verified demonstrations

| Check | Result |
| --- | --- |
| Real ESP32 Arduino compilation | **Passed**, both placeholder and private disposable-header builds. PlatformIO Core 6.2.0, Espressif32 6.12.0, Arduino-ESP32 2.0.17, Xtensa GCC 8.4.0. Produced firmware.bin and firmware.elf. |
| Node HTTP sender | **Passed**, three HTTP 202 frames, Zone B suspicion, then Stale and Disconnected without added samples. This is not Wokwi execution. |
| Firmware executing inside Wokwi and transmitting to Flowra | **Passed.** Wokwi Terminal reported HTTP 202 for normal frames 57–59. Connected device displayed advancing receipt times for sequences 6, 7 and 8 at 15:39:20.490Z, 15:39:25.778Z and 15:39:31.026Z. |
| Wokwi serial command `2` | **Passed.** Sequence 87 had two consecutive Zone B imbalances and zero alerts. By sequence 89, Analysis & alerts displayed **Suspected leak · Zone B** with a 12 L/min imbalance. |
| Wokwi serial command `s` | **Passed.** The receiver marked sequence 161 stale at about 15 seconds and disconnected at about 45 seconds. Connected device showed both states. Its receipt stayed at 15:53:35.206Z and all 90 retained samples stayed identical. |
| Wokwi serial commands `1`, then `r` | **Passed.** Sequence 162 arrived at 15:57:33.621Z. Connected device returned to **Receiving readings** and started a fresh history window. Subsequent normal readings had zero Zone B imbalance and the active leak alert cleared. |
| Wokwi telemetry and Gemini together | The team ran `serve --with-gemini`, confirmed that Gemini 3.5 Flash-Lite reported the frozen ESP32 snapshot’s tank volume, and asked it to explain the observed 12 L/min Zone B imbalance. |

The old source filter excluded PlatformIO's generated sketch.ino.cpp and caused Nothing to build. The filter now includes that compiled source. No private credential is required to compile: without secrets.h the example configuration compiles but deliberately refuses to transmit.

The initial Wokwi run returned HTTP 400. The serial validation message identified a future timestamp. Device UTC was 15:29:34Z and receiver UTC was 15:29:10Z. The private-gateway firmware now synchronizes with the receiver before sampling.

## Networking choices

- **Preferred: Wokwi for VS Code.** Official project configuration documentation says the extension bundles its Private IoT Gateway. It supports ESP32 outbound connections to your computer through host.wokwi.internal. No incoming net.forward rule is needed for ESP32 -> Flowra. Extension installation and a valid Wokwi license/session are still required; having VS Code alone is insufficient.
- **Browser public gateway:** cannot reach localhost or the private LAN. Wokwi documents monitored traffic. Do not put a working token in a public sketch.
- **Browser private gateway:** a separate local application, explicitly enabled in the browser; Wokwi documents that this browser feature is for paying users. Do not assume the browser and VS Code license/gateway arrangements are identical.

No gateway, public tunnel, billing plan, account or deployment was enabled by this task. Account creation is described as free in Wokwi's setup guide, but that does not establish your license entitlement or future pricing. Review the license screen yourself; do not purchase anything just to complete Flowra's local Node fallback.

Official references checked for this setup:

- [ESP32 WiFi, gateway differences and host.wokwi.internal](https://docs.wokwi.com/guides/esp32-wifi)
- [VS Code installation and license activation](https://docs.wokwi.com/vscode/getting-started)
- [Project configuration, bundled IoT gateway and config selection](https://docs.wokwi.com/vscode/project-config)
- [PlatformIO firmware paths and build workflow](https://docs.wokwi.com/vscode/platformio)
- [Serial Monitor input and configuration](https://docs.wokwi.com/guides/serial-monitor)

## Beginner walkthrough: Windows 11 / VS Code

### 1. Install or confirm the tools

You need Git, Node.js 22 with npm, Python 3 with pip, VS Code and the **Wokwi for VS Code** extension with a working local gateway. From a fresh PowerShell terminal, clone the repository and install the JavaScript dependencies:

```powershell
git clone https://github.com/kunnampallideepak-max/flowra.git
cd flowra
npm.cmd ci
```

Open that `flowra` folder in VS Code. Run the remaining commands from its root.

In VS Code, Ctrl+Shift+X opens Extensions. Install Wokwi for VS Code from its official publisher. Press F1 -> **Wokwi: Request a new License** and follow the official browser sign-in/activation instructions using your own account. This task cannot activate it for you. If access is unavailable or the terms require a plan you do not want, stop the Wokwi steps and use the local Node sender below.

### 2. Prepare an isolated, disposable local configuration

Open the Flowra root folder in VS Code, then Terminal -> New Terminal (PowerShell). Run:

```powershell
npm.cmd run build
node scripts/wokwi-demo.mjs prepare
```

Prepare generates a new 32-byte random device-only credential in ignored .tools/wokwi-demo.json and hardware/wokwi-esp32/secrets.h. Nothing is printed. Existing private configuration is never overwritten. If you already have secrets.h, back it up privately yourself before using the disposable workflow. The helper leaves root .env.local and its Gemini key unchanged.

The generated firmware URL is **http://host.wokwi.internal:3002/api/telemetry**. Both startup modes bind to **127.0.0.1:3002** and validate the same device credential and ID. The Gemini API key belongs only on the Flowra server.

### 3. Compile the firmware

Install PlatformIO in the project’s ignored tools directory once:

```powershell
python -m venv .tools/pio-venv
& .\.tools\pio-venv\Scripts\python.exe -m pip install platformio==6.2.0
```

From the Flowra root, build:

```powershell
$env:PLATFORMIO_CORE_DIR = Join-Path (Get-Location) '.tools/platformio-core'
& .\.tools\pio-venv\Scripts\python.exe -m platformio run --project-dir hardware/wokwi-esp32
```

The first build downloads the free compiler/framework and can take several minutes. Success must end with SUCCESS and create:

- hardware/wokwi-esp32/.pio/build/esp32dev/firmware.bin
- hardware/wokwi-esp32/.pio/build/esp32dev/firmware.elf

These are private build artifacts when credentials are compiled in. They are gitignored; never upload them or a configured sketch to a public project. Rebuild after every credential/source change. If the serial output says configure the device token, you built the placeholder configuration or are running an old binary.

### 4. Start the local Flowra receiver

Choose one startup mode and leave its PowerShell terminal open.

**ESP32 telemetry with rules-based summaries.** This default mode disables Gemini even when you have a configured key.

```powershell
node scripts/wokwi-demo.mjs serve
```

**ESP32 telemetry with Gemini.** On a fresh clone, run `Copy-Item .env.example .env.local` once. If `.env.local` already exists, use the existing file. In that private file set `GEMINI_API_KEY` to your own key. Use `GEMINI_MODEL=gemini-3.5-flash-lite` and `GEMINI_TIMEOUT_MS=60000` as in the example. The timeout is in milliseconds, accepts integers from 1000 through 120000 and defaults to 60000. An empty model setting selects the application default, `gemini-flash-latest`.

```powershell
node scripts/wokwi-demo.mjs serve --with-gemini
```

The opt-in startup message is **Gemini allowed using server configuration**. Generation uses the server’s environment, including `.env.local`. A missing key or provider failure leaves the rules-based summary available. To switch modes, press **Ctrl+C** in the receiver terminal and start it with the other command. Reuse the prepared device credential and compiled firmware. After a receiver restart, wait for a new frame before asking about it.

Open **http://127.0.0.1:3002**, sign in using operator / flowra2026, and go to **Demo & settings -> Connected device**. If a locality-assigned network is active, open **Networks -> Open default three-zone network** first: only that network has a device mapping. No geographic selection should reassign telemetry.

This is a separate process-local buffer from another Flowra instance on port 3000. Do not expect frames posted to port 3002 to appear on port 3000. No public tunnel or firewall opening is required for the intended local VS Code gateway.

### 5. Start Wokwi and inspect Serial Monitor

Keep the root folder open. Press F1 -> **Wokwi: Select Config File**, and select hardware/wokwi-esp32/wokwi.toml. Then F1 -> **Wokwi: Start Simulator**. Alternatively open hardware/wokwi-esp32 as its own VS Code folder so wokwi.toml is at the workspace root. Wokwi does not compile firmware itself.

After rebuilding, look for `Clock source: private Flowra receiver before each new sample.` in **Wokwi Terminal**. If you still see the previous firmware output, click the **Wokwi** icon in the left sidebar, expand **Simulation Control**, and select **Restart Simulation**. If the simulator is closed, use **F1 → Wokwi: Start Simulator**. A restart boots into scenario 1. If you paused transmissions with `s` during the current boot, enter `r` to resume.

The VS Code extension's bundled local gateway must actually start successfully. Keep the simulator tab visible; a background tab may pause simulation. Inspect Wokwi output for startup/license/network failures. Do not install a browser gateway or invent gateway settings in wokwi.toml to bypass license errors.

The diagram connects ESP32 TX0/RX0 to the simulator Serial Monitor. It shows firmware messages at 115200 baud. Expected milestones:

1. Connected simulated ESP32 disclosure.
2. WiFi connected (Wokwi-GUEST, channel 6).
3. `Clock source: private Flowra receiver before each new sample.` The ESP32 obtains UTC from the HTTP Date on a fresh, credential-free HEAD request to its configured local endpoint. If the clock request fails, it skips the sample. Configured external HTTPS endpoints continue to use NTP.
4. HTTP 202 / Accepted, including a sequence number.
5. Flowra's received timestamp advances and normal zone values appear.

WiFi connected without HTTP 202 is not proof of ingestion. Only this firmware-in-Wokwi sequence establishes Wokwi-to-Flowra delivery; capture serial status and a redacted UI screenshot without exposing source/credentials.

### 6. Test normal, leak and loss of connection

Type a command into Serial Monitor's input and press Enter:

| Command | Action |
| --- | --- |
| 1 | Normal synthetic readings: source 68 L/min, tank starts near 78%, three baseline demand zones |
| 2 | Synthetic Zone B leak: 12 L/min inlet/outlet imbalance before supply scaling |
| 3 | Synthetic Zone C demand spike |
| 4 | Limited synthetic supply: tank starts near 16%, source 15 L/min |
| s | Stop transmissions without controlling any real hardware |
| r | Resume synthetic transmissions |

Wait for three consecutive accepted leak frames (normally about 15 seconds plus network/simulator latency). Flowra should show a **suspected** Zone B leak using the same detector as internal simulation. Virtual controls remain preview-only in connected mode.

**Verify Gemini on the ESP32 readings** when running with `--with-gemini`:

1. In **Demo & settings**, select **Connected device**. Check that Wokwi reports HTTP 202 and Flowra shows **Receiving readings** with an advancing receipt time.
2. Open **Ask Flowra**, choose **Use latest snapshot** and look for **Device frame received**. Ask “How much water is in this snapshot, in litres?” Compare the **AI-generated response** with the tank volume in **Snapshot evidence**.
3. Enter `2` in Wokwi’s Serial Monitor to select the Zone B leak scenario. Once Analysis shows the alert, use the latest snapshot again and ask “How large is the Zone B inlet/outlet imbalance?” Compare the answer with the inlet minus the outlet for that frame. The team observed **12 L/min** in its verified run.

After s or stopping Wokwi, expect **Stale** after 15 seconds and **Disconnected** after 45 seconds from the last fresh frame. Values must stay historical; sequence/history must not advance. These are receiver wall-clock intervals, not an accelerated simulation clock. Press r or restart to resume. Always use the source label to distinguish ESP32 firmware from the Node fallback.

### 7. Stop and rotate the disposable configuration

Stop Wokwi, then press Ctrl+C in the helper server terminal. The helper stops only its own server process tree. After that, run:

```powershell
node scripts/wokwi-demo.mjs cleanup
```

Cleanup removes only the generated matching private header/configuration. It does not revoke credentials in a still-running process: **stop the test server first**. The normal app's token and Gemini settings were never changed. Run prepare again to create a new credential for the next test, then rebuild. Never publish a previously configured binary; rebuild without secrets.h before sharing any compile artifact.

## Existing Node fallback (no Wokwi account or gateway)

For your ordinary local server with its existing separate token configured in .env.local:

```powershell
npm.cmd run dev
# In a second root terminal:
node scripts/send-telemetry.mjs --scenario=leak --count=6
```

Select Connected device in Demo & settings on that same server/port. For another port, use --url=http://127.0.0.1:PORT/api/telemetry. The sender requires the token of that server; the root .env.local token will not authenticate the disposable port-3002 server. It prints acceptance status, never the token. This is a reproducible real HTTP fallback, **not Wokwi firmware execution**.

## Firmware safeguards and failures

- Normal POST attempts are spaced by at least five simulated seconds. WiFi attempts are bounded to 12 seconds and retried on a 15-second schedule. The private clock request must return HTTP 200 with a valid GMT date within three simulated seconds. The ESP32 sets its clock before generating readings, including the first new sample after resume. Rejected samples are discarded.
- Complete frames retain schema v1, stable sensor IDs, percent/L/min units, random per-boot identity, increasing sequences and UTC measuredAt. The synthetic model accounts for available storage; it cannot deliver phantom water after draining.
- HTTP timeouts are bounded (5-second connect / 10-second response). Redirects are disabled. 401 stops transmission; 429/503 back off to 15 seconds. Raw response bodies, URLs and credentials are never logged.
- On HTTP 400, read the next `Flowra validation:` line in **Wokwi Terminal**. The firmware prints a recognized Flowra validation message and the frame's UTC measurement time. A `Receiver UTC:` line gives the response's HTTP Date when available. Flowra accepts measurements up to 30 seconds old or 10 seconds ahead of its clock. An unrecognized response leaves the cause undetermined. Raw response bodies and authorization headers stay out of the terminal.
- 409: sequence or timestamp replay/out-of-order. Wait for a genuinely newer frame or restart; do not replay saved JSON.
- 401/503: check the device configuration privately, matching server process and compiled binary. Never use GEMINI_API_KEY as a device token.
- Network/TLS errors: verify gateway access and the actual receiver port. Local plain HTTP is restricted to an exact host.wokwi.internal endpoint and the documented private-gateway DHCP subnet (10.13.37.x). The sketch refuses HTTP credentials on the public-gateway subnet. This configuration guard is not device attestation or proof of receiver connectivity. External HTTPS requires a trusted root CA; no setInsecure() bypass is implemented.

## If a local Wokwi gateway remains unavailable

Use the Node fallback. An operator-controlled private HTTPS relay with correct certificate validation and a disposable device-only token is a possible alternative, but it requires separate, explicit infrastructure setup and permission. No relay, tunnel or deployment is created here. Never send a long-lived credential through a public sketch, put a token in a URL, or add an unauthenticated ingestion endpoint. The existing authentication, schema checks, timestamp/replay protection and rate limits remain mandatory.
