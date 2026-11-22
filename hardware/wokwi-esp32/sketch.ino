// Connected simulated ESP32: all values below are synthetic, not physical sensors.
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <sys/time.h>
#include <math.h>
#include <esp_system.h>
#include "telemetry_payload.h"
#if __has_include("secrets.h")
#include "secrets.h"
#else
// Safe compile-only default. Placeholder credentials disable transmission at runtime.
#include "secrets.example.h"
#endif

uint32_t sequenceNumber = 0;
char bootId[24];
int scenario = 1;
double tankLitres = 15600;
unsigned long lastSent = 0;
unsigned long lastClockSync = 0;
unsigned long lastWiFiAttempt = 0;
unsigned long sendInterval = 5000;
bool transmitting = true;

bool localEndpoint(const String& url) {
  const String prefix = "http://host.wokwi.internal:";
  if (!url.startsWith(prefix) || !url.endsWith("/api/telemetry")) return false;
  const int end = url.indexOf('/', prefix.length());
  if (end <= (int)prefix.length()) return false;
  const String port = url.substring(prefix.length(), end);
  for (unsigned int i = 0; i < port.length(); i++) if (port[i] < '0' || port[i] > '9') return false;
  return port.length() <= 5 && port.toInt() > 0 && port.toInt() <= 65535 && url.substring(end) == "/api/telemetry";
}
void connectWiFi() {
  lastWiFiAttempt = millis();
  WiFi.disconnect(); WiFi.begin("Wokwi-GUEST", "", 6);
  Serial.println("WiFi: connecting to Wokwi-GUEST (bounded 12-second attempt)...");
  const unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 12000) delay(100);
  Serial.println(WiFi.status() == WL_CONNECTED ? "WiFi connected. HTTP 202 still required to prove delivery." : "WiFi unavailable. Next attempt in 15 seconds; no frame fabricated.");
}

bool parseReceiverDate(const String& date, struct tm& utc) {
  const char* end = strptime(date.c_str(), "%a, %d %b %Y %H:%M:%S GMT", &utc);
  return date.length() == 29 && end && !*end && utc.tm_year >= 124;
}

bool onPrivateGateway() {
  const IPAddress ip = WiFi.localIP();
  if (WiFi.status() == WL_CONNECTED && ip[0] == 10 && ip[1] == 13 && ip[2] == 37) return true;
  Serial.println("Local private gateway not detected; refusing HTTP credentials. Check Wokwi VS Code networking.");
  return false;
}

// The simulator's millis() and NTP clock can run ahead of the Windows receiver.
// Synchronize before sampling. Failed or rejected samples are never re-dated.
bool syncPrivateClock(const String& url) {
  WiFiClient client;
  HTTPClient clock;
  if (!clock.begin(client, url)) return false;
  clock.setConnectTimeout(3000);
  clock.setTimeout(3000);
  clock.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
  const char* headers[] = { "Date" };
  clock.collectHeaders(headers, 1);
  clock.addHeader("Cache-Control", "no-cache");
  const unsigned long started = millis();
  const int status = clock.sendRequest("HEAD");
  const String date = clock.header("Date");
  clock.end();
  struct tm utc = {};
  if (status != HTTP_CODE_OK || millis() - started > 3000 || !parseReceiverDate(date, utc)) return false;
  // setup() selects UTC0 for this private receiver. Round-trip rejects malformed calendar dates.
  const time_t seconds = mktime(&utc);
  char canonical[30];
  if (seconds == (time_t)-1 || !strftime(canonical, sizeof(canonical), "%a, %d %b %Y %H:%M:%S GMT", &utc) || date != canonical) return false;
  const struct timeval now = { seconds, 0 };
  return settimeofday(&now, nullptr) == 0;
}

// Decode only Flowra's fixed validation messages. Never echo server-supplied text.
void reportValidationFailure(HTTPClient& http, const char* measuredAt) {
  const char* const reasons[] = {
    "Reading timestamp is too old or in the future. Synchronize the device clock.",
    "measuredAt must be a UTC ISO timestamp.",
    "Invalid JSON body.",
    "JSON body is required.",
    "Payload fields do not match the documented telemetry schema.",
    "Unknown schema version, device identifier or source. Only configured synthetic demo sources are accepted.",
    "Invalid boot identifier or sequence.",
    "Tank reading must use tank-01, percent units and a value from 0 to 100.",
    "Source reading must use source-01 and L/min from 0 to 500.",
    "A complete frame must contain Zones A, B and C.",
    "Each known zone must appear exactly once.",
    "Unknown zone sensor identifier or flow unit.",
    "Invalid zone flow, demand or valve value. Outlet cannot exceed inlet in this demo schema."
  };
  // HTTP/1.0 lets the receiver delimit a small JSON error by length or connection close.
  char reply[192] = {};
  size_t used = 0;
  WiFiClient* stream = http.getStreamPtr();
  const unsigned long started = millis();
  while (stream && used < sizeof(reply) - 1 && millis() - started < 1500) {
    if (!stream->available()) {
      if (!stream->connected()) break;
      delay(2);
      continue;
    }
    const int ch = stream->read();
    if (ch < 0) break;
    reply[used++] = (char)ch;
    if (ch == '}') break;
  }
  const char* reason = "Unrecognized validation response.";
  char expected[192];
  for (const char* known : reasons) {
    snprintf(expected, sizeof(expected), "{\"message\":\"%s\"}", known);
    if (strcmp(reply, expected) == 0) {
      reason = known;
      break;
    }
  }
  Serial.printf("Flowra validation: %s Device UTC: %s.\n", reason, measuredAt);
  const String date = http.header("Date");
  struct tm server = {};
  char serverIso[24];
  if (parseReceiverDate(date, server) && strftime(serverIso, sizeof(serverIso), "%Y-%m-%dT%H:%M:%SZ", &server)) {
    Serial.printf("Receiver UTC: %s.\n", serverIso);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("Flowra: Connected simulated ESP32. No physical water sensors.");
  if (strlen(FLOWRA_TOKEN) < 32 || String(FLOWRA_TOKEN).startsWith("REPLACE_")) {
    Serial.println("Configure the separate device token in private secrets.h first.");
    while (true) delay(1000);
  }
  snprintf(bootId, sizeof(bootId), "%08lx-%08lx", (unsigned long)esp_random(), (unsigned long)esp_random());
  WiFi.mode(WIFI_STA); connectWiFi();
  if (localEndpoint(FLOWRA_URL)) {
    setenv("TZ", "UTC0", 1);
    tzset();
    Serial.println("Clock source: private Flowra receiver before each new sample.");
  } else {
    configTime(0, 0, "pool.ntp.org", "time.google.com"); lastClockSync = millis();
  }
  Serial.println("Serial controls: s stops transmission, r resumes. Never controls real hardware.");
  Serial.println("Select synthetic scenario: 1 normal, 2 Zone B leak, 3 Zone C demand spike, 4 limited supply.");
}

void loop() {
  while (Serial.available()) {
    const char choice = Serial.read();
    if (choice == 's') { transmitting = false; Serial.println("Transmission stopped. Flowra will age the last received frame."); }
    if (choice == 'r') { transmitting = true; lastSent = millis(); Serial.println("Synthetic transmission resumed."); }
    if (choice >= '1' && choice <= '4') {
      scenario = choice - '0'; tankLitres = scenario == 4 ? 3200 : 15600;
      Serial.printf("Synthetic scenario %d selected.\n", scenario);
    }
  }
  if (!transmitting) { delay(20); return; }
  if (WiFi.status() != WL_CONNECTED && millis() - lastWiFiAttempt >= 15000) connectWiFi();
  if (millis() - lastSent < sendInterval) { delay(20); return; }
  lastSent = millis();
  if (WiFi.status() != WL_CONNECTED) { Serial.println("WiFi disconnected; no frame sent."); return; }
  const String url(FLOWRA_URL);
  const bool privateReceiver = localEndpoint(url);
  if (privateReceiver) {
    if (!onPrivateGateway()) return;
    if (!syncPrivateClock(url)) {
      Serial.println("Private receiver clock unavailable. Skipping this sample.");
      lastSent = millis();
      return;
    }
  } else if (millis() - lastClockSync > 30000) {
    configTime(0, 0, "pool.ntp.org", "time.google.com"); lastClockSync = millis();
  }
  struct tm utc;
  if (!getLocalTime(&utc, 100) || utc.tm_year < 124) { Serial.println("Waiting for a valid UTC clock; no frame sent."); return; }
  char measuredAt[24]; strftime(measuredAt, sizeof(measuredAt), "%Y-%m-%dT%H:%M:%SZ", &utc);
  const double bases[3] = {24, 21.6, 14.4};
  const double source = scenario == 4 ? 15 : 68;
  double demand[3], inlet[3], outlet[3]; double distribution = 0;
  for (int i = 0; i < 3; i++) {
    demand[i] = bases[i] * (1.0 + 0.045 * sin(sequenceNumber / 6.0 + i));
    if (scenario == 3 && i == 2) demand[i] *= 2.2;
    outlet[i] = demand[i]; inlet[i] = outlet[i] + ((scenario == 2 && i == 1) ? 12 : 0);
    distribution += inlet[i];
  }
  // Limit synthetic delivery by available storage, even in a prolonged shortage.
  const double requested = distribution * 5.0 / 60.0;
  const double available = tankLitres + source * 5.0 / 60.0;
  const double fraction = requested > available && requested > 0 ? available / requested : 1.0;
  for (int i = 0; i < 3; i++) { inlet[i] *= fraction; outlet[i] *= fraction; }
  distribution *= fraction;
  // Five simulated seconds per frame. Model values only; no sensor-accuracy claim.
  tankLitres = fmax(0.0, fmin(20000.0, tankLitres + (source - distribution) * 5.0 / 60.0));
  char body[2200];
  const uint32_t frameSequence = sequenceNumber++;
  const int written = formatFlowraFrame(body, sizeof(body), FLOWRA_DEVICE_ID, bootId, frameSequence, measuredAt, tankLitres, source, inlet, outlet, demand);
  if (written < 0 || written >= (int)sizeof(body)) { Serial.println("Frame too large; not sent."); return; }
  if (url.indexOf('@') >= 0 || url.indexOf('?') >= 0 || url.indexOf('#') >= 0 || !url.endsWith("/api/telemetry")) { Serial.println("Endpoint must have no userinfo, query or fragment and end in /api/telemetry."); return; }
  WiFiClient localClient;
  WiFiClientSecure tlsClient;
  HTTPClient http;
  bool began = false;
  if (url.startsWith("https://")) {
    if (!String(FLOWRA_CA_CERT).startsWith("\n-----BEGIN CERTIFICATE-----") && !String(FLOWRA_CA_CERT).startsWith("-----BEGIN CERTIFICATE-----")) { Serial.println("HTTPS requires a trusted bridge root CA in secrets.h."); return; }
    tlsClient.setCACert(FLOWRA_CA_CERT); began = http.begin(tlsClient, url);
  } else if (privateReceiver) {
    if (!onPrivateGateway()) return;
    began = http.begin(localClient, url);
  } else { Serial.println("Use HTTPS, or the local host.wokwi.internal private gateway."); return; }
  if (!began) { Serial.println("HTTP setup failed; no frame sent."); return; }
  http.setConnectTimeout(5000); http.setTimeout(10000);
  http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
  http.useHTTP10(true);
  const char* responseHeaders[] = { "Date" };
  http.collectHeaders(responseHeaders, 1);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + FLOWRA_TOKEN);
  const int status = http.POST((uint8_t*)body, strlen(body));
  Serial.printf("Synthetic frame %lu / scenario %d / HTTP %d.\n", (unsigned long)frameSequence, scenario, status);
  if (status == 202) Serial.println("Accepted. Compare the new server receipt timestamp in Flowra.");
  else if (status == 401) { Serial.println("Authentication rejected. Transmission stopped; check private device configuration and rebuild."); transmitting = false; }
  else if (status == 400) reportValidationFailure(http, measuredAt);
  else if (status == 409) Serial.println("Sequence/timestamp rejected. Wait for fresh UTC time or restart the simulator.");
  else if (status == 429) Serial.println("Rate limited. Waiting 15 seconds before a new sample.");
  else if (status == 503) Serial.println("Ingestion unavailable. Check the separate server token; waiting 15 seconds.");
  else if (status < 0) Serial.println("Network/TLS failure. Verify the private gateway, server port and CA. No immediate retry.");
  else Serial.println("Unexpected server status; no response body logged.");
  sendInterval = status == 429 || status == 503 ? 15000 : 5000;
  lastSent = millis();
  http.end();
}
