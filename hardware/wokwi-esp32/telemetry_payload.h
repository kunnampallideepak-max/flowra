#pragma once
#include <stdio.h>
#include <stdint.h>
// Shared wire-format formatter. Only synthetic values; never include credentials.
inline int formatFlowraFrame(char* body, size_t capacity, const char* deviceId, const char* bootId, uint32_t sequence, const char* measuredAt, double tankLitres, double source, const double* inlet, const double* outlet, const double* demand) {
  return snprintf(body, capacity,
    "{\"schemaVersion\":1,\"deviceId\":\"%s\",\"source\":\"connected-simulated-esp32\",\"bootId\":\"%s\",\"sequence\":%lu,\"measuredAt\":\"%s\","
    "\"tank\":{\"sensorId\":\"tank-01\",\"levelPercent\":%.4f,\"unit\":\"%%\"},\"sourceFlow\":{\"sensorId\":\"source-01\",\"flow\":%.3f,\"unit\":\"L/min\"},\"zones\":["
    "{\"zoneId\":\"A\",\"inletSensorId\":\"flow-A-in\",\"outletSensorId\":\"flow-A-out\",\"inlet\":%.3f,\"outlet\":%.3f,\"demand\":%.3f,\"valvePercent\":100,\"unit\":\"L/min\"},"
    "{\"zoneId\":\"B\",\"inletSensorId\":\"flow-B-in\",\"outletSensorId\":\"flow-B-out\",\"inlet\":%.3f,\"outlet\":%.3f,\"demand\":%.3f,\"valvePercent\":100,\"unit\":\"L/min\"},"
    "{\"zoneId\":\"C\",\"inletSensorId\":\"flow-C-in\",\"outletSensorId\":\"flow-C-out\",\"inlet\":%.3f,\"outlet\":%.3f,\"demand\":%.3f,\"valvePercent\":100,\"unit\":\"L/min\"}]}",
    deviceId, bootId, (unsigned long)sequence, measuredAt, tankLitres / 200.0, source,
    inlet[0], outlet[0], demand[0], inlet[1], outlet[1], demand[1], inlet[2], outlet[2], demand[2]);
}
