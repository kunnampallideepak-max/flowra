#pragma once
// Copy to secrets.h locally. That file is gitignored. Never put a Gemini key here.
#define FLOWRA_URL "http://host.wokwi.internal:3000/api/telemetry"
#define FLOWRA_TOKEN "REPLACE_WITH_YOUR_SEPARATE_DEVICE_TOKEN"
#define FLOWRA_DEVICE_ID "esp32-flowra-01"
// For HTTPS bridges, paste the trusted root CA PEM for your bridge host here.
// The sketch refuses HTTPS without a CA. It never disables TLS verification.
static const char FLOWRA_CA_CERT[] = R"PEM(
)PEM";
