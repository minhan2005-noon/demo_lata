import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTelemetryItems, validateTelemetry } from "../src/services/sensors.service.js";

test("maps the DHT22 and MQ2 firmware payload to registered sensors", () => {
  const payload = {
    deviceId: "lata-001",
    dht22_temperature_c: 29.4,
    dht22_humidity_percent: 71.2,
    mq2_raw: 1380,
    mq2_ppm: 245
  };

  const items = normalizeTelemetryItems(payload);
  assert.deepEqual(
    items.map(({ sensorId, type, value }) => ({ sensorId, type, value })),
    [
      { sensorId: "dht22-temp-001", type: "dht22_temperature", value: 29.4 },
      { sensorId: "dht22-humidity-001", type: "dht22_humidity", value: 71.2 },
      { sensorId: "mq2-raw-001", type: "mq2_raw", value: 1380 },
      { sensorId: "mq2-ppm-001", type: "mq2_gas", value: 245 }
    ]
  );

  for (const item of items) {
    const result = validateTelemetry(item, payload.deviceId);
    assert.equal(result.errors, undefined);
    assert.equal(result.reading.deviceId, payload.deviceId);
  }
});

test("accepts short aliases used by simple firmware test sketches", () => {
  const items = normalizeTelemetryItems({
    deviceId: "lata-001",
    dht22_temp: 27.8,
    humidity: 65,
    mq2_adc: 930,
    gas_ppm: 120
  });

  assert.deepEqual(
    items.map((item) => item.type),
    ["dht22_temperature", "dht22_humidity", "mq2_raw", "mq2_gas"]
  );
});
