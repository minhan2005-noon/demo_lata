import { addAlert, addLog, sensorMeta, sensorReadings } from "../store.js";
import { findDevice } from "./devices.service.js";
import { writeTelemetryReadings } from "./influx.service.js";

export const getLatestReadings = () => {
  const latestBySensor = new Map();

  for (const reading of sensorReadings) {
    const current = latestBySensor.get(reading.sensorId);
    if (!current || new Date(reading.timestamp) > new Date(current.timestamp)) {
      latestBySensor.set(reading.sensorId, reading);
    }
  }

  return [...latestBySensor.values()].sort((a, b) => a.sensorId.localeCompare(b.sensorId));
};

const typeAliases = {
  do: "dissolved_oxygen",
  dissolved_oxygen: "dissolved_oxygen",
  ec: "electrical_conductivity",
  electrical_conductivity: "electrical_conductivity",
  nh4: "ammonium",
  amoni: "ammonium",
  ammonia: "ammonium",
  ammonium: "ammonium",
  turbidity: "tss",
  tss: "tss"
};

const normalizeSensorType = (type) => {
  if (!type) return type;
  const normalized = String(type).trim().toLowerCase();
  return typeAliases[normalized] || normalized;
};

const firmwareFieldMap = {
  flow_in: "flow_in",
  flow_in_m3h: "flow_in",
  inlet_flow: "flow_in",
  flow_out: "flow_out",
  flow_out_m3h: "flow_out",
  outlet_flow: "flow_out",
  ph: "ph",
  temperature: "temperature",
  temperature_c: "temperature",
  cod: "cod",
  cod_mgl: "cod",
  bod: "bod",
  bod_mgl: "bod",
  toc: "toc",
  toc_mgl: "toc",
  do: "dissolved_oxygen",
  do_mgl: "dissolved_oxygen",
  dissolved_oxygen: "dissolved_oxygen",
  ec: "electrical_conductivity",
  ec_mscm: "electrical_conductivity",
  electrical_conductivity: "electrical_conductivity",
  color: "color",
  color_ptco: "color",
  nh4: "ammonium",
  nh4_mgl: "ammonium",
  amoni: "ammonium",
  ammonium: "ammonium",
  ammonium_mgl: "ammonium",
  tss: "tss",
  tss_mgl: "tss",
  turbidity: "tss",
  turbidity_ntu: "tss"
};

const findSensorMetaByDeviceAndType = (deviceId, type) =>
  Object.values(sensorMeta).find((meta) => meta.deviceId === deviceId && meta.type === normalizeSensorType(type));

export const normalizeTelemetryItems = (body) => {
  if (Array.isArray(body.readings)) return body.readings;
  if (Array.isArray(body.data)) return body.data;
  if (body.sensorId && body.value !== undefined) return [body];

  if (body.deviceId) {
    const seenTypes = new Set();
    const readings = [];

    for (const [field, value] of Object.entries(body)) {
      const rawType = firmwareFieldMap[field] || firmwareFieldMap[field.trim().toLowerCase()];
      if (!rawType || typeof value !== "number" || !Number.isFinite(value)) continue;

      const type = normalizeSensorType(rawType);
      if (seenTypes.has(type)) continue;

      const meta = findSensorMetaByDeviceAndType(body.deviceId, type);
      readings.push({
        deviceId: body.deviceId,
        sensorId: meta?.id || `${type}-${body.deviceId}`,
        type,
        value,
        timestamp: body.timestamp || body.recordedAt
      });
      seenTypes.add(type);
    }

    if (readings.length) return readings;
  }

  return null;
};

export const validateTelemetry = (item, fallbackDeviceId) => {
  const errors = [];
  const requestedType = item.type || item.measurement || item.parameter;
  const deviceIdCandidate = item.deviceId || fallbackDeviceId;
  const inferredMeta =
    !item.sensorId && deviceIdCandidate && requestedType
      ? findSensorMetaByDeviceAndType(deviceIdCandidate, requestedType)
      : null;
  const sensorId = item.sensorId || inferredMeta?.id;
  const meta = sensorMeta[sensorId] || inferredMeta;

  if (!sensorId || typeof sensorId !== "string") errors.push("sensorId is required.");
  if (!meta) errors.push(`Unknown sensorId: ${sensorId}.`);
  if (typeof item.value !== "number" || !Number.isFinite(item.value)) errors.push("value must be a number.");

  const timestamp = item.timestamp ? new Date(item.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) errors.push("timestamp must be a valid ISO date.");

  const deviceId = item.deviceId || fallbackDeviceId || meta?.deviceId;
  if (!deviceId) errors.push("deviceId is required.");
  if (meta && deviceId !== meta.deviceId) {
    errors.push(`sensorId ${sensorId} does not belong to deviceId ${deviceId}.`);
  }
  if (deviceId && !findDevice(deviceId)) errors.push(`Unknown deviceId: ${deviceId}.`);

  if (meta && typeof item.value === "number" && (item.value < meta.min || item.value > meta.max)) {
    errors.push(`value must be between ${meta.min} and ${meta.max}${meta.unit}.`);
  }

  if (errors.length) return { errors };

  return {
    reading: {
      sensorId,
      deviceId,
      type: meta.type,
      value: item.value,
      unit: item.unit || meta.unit,
      timestamp: timestamp.toISOString()
    }
  };
};

export const createThresholdAlert = (reading) => {
  const meta = sensorMeta[reading.sensorId];
  if (!meta) return null;

  const isCriticalLow = meta.criticalMin !== undefined && reading.value < meta.criticalMin;
  const isCriticalHigh = meta.criticalMax !== undefined && reading.value > meta.criticalMax;
  const isWarningLow = meta.warningMin !== undefined && reading.value < meta.warningMin;
  const isWarningHigh = meta.warningMax !== undefined && reading.value > meta.warningMax;

  const severity = isCriticalLow || isCriticalHigh ? "critical" : isWarningLow || isWarningHigh ? "warning" : null;
  if (!severity) return null;

  const direction = isCriticalLow || isWarningLow ? "below" : "above";
  const limit =
    isCriticalLow ? meta.criticalMin :
    isCriticalHigh ? meta.criticalMax :
    isWarningLow ? meta.warningMin :
    meta.warningMax;
  const alertType = `${reading.type.toUpperCase().replaceAll("-", "_")}_OUT_OF_RANGE`;

  return addAlert({
    deviceId: reading.deviceId,
    sensorId: reading.sensorId,
    type: alertType,
    severity,
    message: `${meta.name || reading.type} is ${direction} ${severity} threshold ${limit}${meta.unit ? ` ${meta.unit}` : ""} (${reading.value}${reading.unit ? ` ${reading.unit}` : ""}).`
  });
};

export const saveTelemetryReadings = async (readings) => {
  const createdAlerts = [];
  const influx = await writeTelemetryReadings(readings);

  for (const reading of readings) {
    sensorReadings.push(reading);

    const device = findDevice(reading.deviceId);
    if (device) device.lastSeenAt = reading.timestamp;

    const alert = createThresholdAlert(reading);
    if (alert) createdAlerts.push(alert);
  }

  const deviceIds = [...new Set(readings.map((reading) => reading.deviceId))];
  for (const deviceId of deviceIds) {
    const count = readings.filter((reading) => reading.deviceId === deviceId).length;
    addLog({
      deviceId,
      type: "TELEMETRY_RECEIVED",
      message: `Received ${count} telemetry reading(s).`
    });
  }

  return { readings, alerts: createdAlerts, influx };
};
