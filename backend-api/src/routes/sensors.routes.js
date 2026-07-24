import { Router } from "express";
import { sensorMeta, sensorReadings } from "../store.js";
import {
  getLatestReadings,
  normalizeTelemetryItems,
  saveTelemetryReadings,
  validateTelemetry
} from "../services/sensors.service.js";
import { requireApiKey } from "../middleware/security.js";
import { isInfluxEnabled, queryLatestReadings, querySensorHistory } from "../services/influx.service.js";
import { parseDate } from "../utils/date.js";
import { created, fail, ok } from "../utils/http.js";

const router = Router();

const filterMemoryReadings = ({ deviceId, type } = {}) => {
  let result = getLatestReadings();
  if (deviceId) result = result.filter((reading) => reading.deviceId === deviceId);
  if (type) result = result.filter((reading) => reading.type === type);
  return result;
};

router.get("/latest", async (req, res, next) => {
  try {
    const { deviceId, type } = req.query;
    let result;
    let source = "memory";

    if (isInfluxEnabled()) {
      try {
        result = await queryLatestReadings({ deviceId, type });
        source = "influxdb";
      } catch (error) {
        console.warn("Falling back to memory readings after InfluxDB latest query failed:", error.message);
        result = filterMemoryReadings({ deviceId, type });
        source = "memory_fallback";
      }
    } else {
      result = filterMemoryReadings({ deviceId, type });
    }

    ok(res, result, { count: result.length, source });
  } catch (error) {
    next(error);
  }
});

router.get("/:sensorId/history", async (req, res, next) => {
  try {
    const { sensorId } = req.params;
    if (!sensorMeta[sensorId]) return fail(res, 404, "SENSOR_NOT_FOUND", "Sensor not found.");

    const start = parseDate(req.query.start, "start");
    const end = parseDate(req.query.end, "end");
    if (start && end && start > end) {
      return fail(res, 400, "INVALID_RANGE", "start must be before end.");
    }

    let result;
    let source = "memory";

    if (isInfluxEnabled()) {
      try {
        result = await querySensorHistory({ sensorId, start, end });
        source = "influxdb";
      } catch (error) {
        console.warn("Falling back to memory readings after InfluxDB history query failed:", error.message);
        result = sensorReadings
          .filter((reading) => reading.sensorId === sensorId)
          .filter((reading) => !start || new Date(reading.timestamp) >= start)
          .filter((reading) => !end || new Date(reading.timestamp) <= end)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        source = "memory_fallback";
      }
    } else {
      result = sensorReadings
        .filter((reading) => reading.sensorId === sensorId)
        .filter((reading) => !start || new Date(reading.timestamp) >= start)
        .filter((reading) => !end || new Date(reading.timestamp) <= end)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    return ok(res, result, {
      count: result.length,
      source,
      sensorId,
      start: start?.toISOString(),
      end: end?.toISOString()
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/data", requireApiKey, async (req, res, next) => {
  try {
    const items = normalizeTelemetryItems(req.body);
    if (!items) {
      return fail(res, 400, "INVALID_PAYLOAD", "Send { sensorId, value } or { readings: [...] }.");
    }

    const validation = items.map((item) => validateTelemetry(item, req.body.deviceId));
    const errors = validation
      .map((result, index) => (result.errors ? { index, errors: result.errors } : null))
      .filter(Boolean);

    if (errors.length) return fail(res, 400, "VALIDATION_FAILED", "Telemetry payload is invalid.", errors);

    const saved = await saveTelemetryReadings(validation.map((result) => result.reading));
    return created(res, saved, {
      count: saved.readings.length,
      alertCount: saved.alerts.length,
      source: saved.influx.enabled ? "influxdb" : "memory"
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
