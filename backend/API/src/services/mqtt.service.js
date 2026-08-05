import mqtt from "mqtt";
import {
  normalizeTelemetryItems,
  saveTelemetryReadings,
  validateTelemetry
} from "./sensors.service.js";

const topicFilter = process.env.MQTT_TOPIC_FILTER || "lata/+/data";
const brokerHost = process.env.MQTT_BROKER || "localhost";
const brokerPort = Number(process.env.MQTT_PORT || 1883);
const inferredProtocol = brokerPort === 8883 ? "mqtts" : "mqtt";
const brokerProtocol = process.env.MQTT_PROTOCOL || inferredProtocol;
const brokerUrl = brokerHost.includes("://")
  ? brokerHost
  : `${brokerProtocol}://${brokerHost}:${brokerPort}`;
const enabled = process.env.MQTT_ENABLED !== "false";

let client;
const status = {
  enabled,
  connected: false,
  subscribed: false,
  broker: brokerHost,
  port: brokerPort,
  protocol: brokerProtocol,
  topicFilter,
  connectedAt: null,
  lastMessageAt: null,
  lastSavedAt: null,
  lastDeviceId: null,
  lastTopic: null,
  lastPayloadFields: [],
  messageCount: 0,
  readingCount: 0,
  rejectedCount: 0,
  lastError: null
};

const timestampFromPayload = (value, receivedAt) => {
  if (value === undefined || value === null || value === "") return receivedAt;

  // ESP32 often sends millis() since boot. It is not a wall-clock timestamp.
  if (typeof value === "number" && value < 1_000_000_000_000) return receivedAt;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return receivedAt;
  if (parsed.getUTCFullYear() < 2020 || parsed.getUTCFullYear() > 2100) return receivedAt;
  return parsed.toISOString();
};

const deviceIdFromTopic = (topic) => {
  const match = String(topic).match(/^lata\/([^/]+)\/data$/);
  return match?.[1] || null;
};

const rejectMessage = (message) => {
  status.rejectedCount += 1;
  status.lastError = message;
  console.warn(`[MQTT] ${message}`);
};

const handleMessage = async (topic, message) => {
  const receivedAt = new Date().toISOString();
  const deviceId = deviceIdFromTopic(topic);

  status.lastMessageAt = receivedAt;
  status.lastTopic = topic;
  status.lastDeviceId = deviceId;

  if (!deviceId) {
    rejectMessage(`Ignored unexpected topic: ${topic}`);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(message.toString("utf8"));
  } catch {
    rejectMessage(`Invalid JSON received on ${topic}`);
    return;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    rejectMessage(`Payload on ${topic} must be a JSON object`);
    return;
  }

  status.lastPayloadFields = Object.keys(payload).slice(0, 30);

  const normalizedPayload = {
    ...payload,
    deviceId,
    timestamp: timestampFromPayload(payload.timestamp ?? payload.recordedAt, receivedAt)
  };
  const items = normalizeTelemetryItems(normalizedPayload);

  if (!items) {
    rejectMessage(`No supported telemetry fields received on ${topic}`);
    return;
  }

  const validation = items.map((item) => validateTelemetry(item, deviceId));
  const errors = validation.flatMap((result) => result.errors || []);
  if (errors.length) {
    rejectMessage(`Telemetry rejected for ${deviceId}: ${errors.join(" ")}`);
    return;
  }

  try {
    const saved = await saveTelemetryReadings(validation.map((result) => result.reading));
    status.lastSavedAt = receivedAt;
    status.messageCount += 1;
    status.readingCount += saved.readings.length;
    status.lastError = null;
    console.log(`[MQTT] Saved ${saved.readings.length} reading(s) from ${deviceId}`);
  } catch (error) {
    rejectMessage(`Failed to save telemetry for ${deviceId}: ${error.message}`);
  }
};

export const getMqttStatus = () => ({ ...status, lastPayloadFields: [...status.lastPayloadFields] });

export const startMqttService = () => {
  if (!enabled || client) return;

  client = mqtt.connect(brokerUrl, {
    clientId: `lata-api-${process.pid}`,
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    keepalive: 60,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    rejectUnauthorized: process.env.MQTT_TLS_REJECT_UNAUTHORIZED !== "false"
  });

  client.on("connect", () => {
    status.connected = true;
    status.subscribed = false;
    status.connectedAt = new Date().toISOString();
    status.lastError = null;

    client.subscribe(topicFilter, { qos: 1 }, (error) => {
      if (error) {
        rejectMessage(`Cannot subscribe to ${topicFilter}: ${error.message}`);
        return;
      }
      status.subscribed = true;
      console.log(`[MQTT] Connected to ${brokerHost}:${brokerPort}, subscribed to ${topicFilter}`);
    });
  });

  client.on("message", (topic, message) => {
    void handleMessage(topic, message);
  });

  client.on("reconnect", () => {
    status.connected = false;
    status.subscribed = false;
  });

  client.on("close", () => {
    status.connected = false;
    status.subscribed = false;
  });

  client.on("error", (error) => {
    status.connected = false;
    status.lastError = error.message;
  });
};

export const stopMqttService = async () => {
  if (!client) return;
  const activeClient = client;
  client = undefined;
  status.connected = false;
  status.subscribed = false;
  await new Promise((resolve) => activeClient.end(false, {}, resolve));
};
