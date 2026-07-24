import { Router } from "express";
import { alerts, devices, logs, sensorMeta, sensorReadings } from "../store.js";
import { isInfluxEnabled, queryReadingsRange } from "../services/influx.service.js";
import { getDayRange } from "../utils/date.js";
import { ok } from "../utils/http.js";

const router = Router();

router.get("/daily", async (req, res, next) => {
  try {
    const { date, start, end } = getDayRange(req.query.date);
    let source = "memory";

    let readings;

    if (isInfluxEnabled()) {
      try {
        readings = await queryReadingsRange({ start, end });
        source = "influxdb";
      } catch (error) {
        console.warn("Falling back to memory readings after InfluxDB report query failed:", error.message);
        readings = sensorReadings.filter((reading) => {
          const timestamp = new Date(reading.timestamp);
          return timestamp >= start && timestamp <= end;
        });
        source = "memory_fallback";
      }
    } else {
      readings = sensorReadings.filter((reading) => {
        const timestamp = new Date(reading.timestamp);
        return timestamp >= start && timestamp <= end;
      });
    }

    const bySensor = readings.reduce((acc, reading) => {
      acc[reading.sensorId] ||= [];
      acc[reading.sensorId].push(reading.value);
      return acc;
    }, {});

    const sensorSummary = Object.entries(bySensor).map(([sensorId, values]) => ({
      sensorId,
      deviceId: sensorMeta[sensorId]?.deviceId,
      type: sensorMeta[sensorId]?.type,
      unit: sensorMeta[sensorId]?.unit,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
      count: values.length
    }));

    const dayAlerts = alerts.filter((alert) => {
      const createdAt = new Date(alert.createdAt);
      return createdAt >= start && createdAt <= end;
    });

    const dayLogs = logs.filter((log) => {
      const createdAt = new Date(log.createdAt);
      return createdAt >= start && createdAt <= end;
    });

    return ok(res, {
      date: date.toISOString().slice(0, 10),
      totals: {
        devices: devices.length,
        readings: readings.length,
        activeAlerts: dayAlerts.filter((alert) => alert.status === "active").length,
        logs: dayLogs.length,
        runningPumps: devices.flatMap((device) => device.pumps).filter((pump) => pump.status === "running").length
      },
      source,
      sensors: sensorSummary,
      alerts: dayAlerts,
      pumps: devices.map((device) => ({
        deviceId: device.id,
        pumps: device.pumps
      }))
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
