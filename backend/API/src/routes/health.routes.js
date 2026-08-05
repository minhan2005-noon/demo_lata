import { Router } from "express";
import { getInfluxConfig } from "../services/influx.service.js";
import { getMqttStatus } from "../services/mqtt.service.js";
import { ok } from "../utils/http.js";

const router = Router();

router.get("/", (req, res) => {
  ok(res, {
    status: "ok",
    service: "lata-api",
    database: {
      telemetry: "influxdb",
      ...getInfluxConfig()
    },
    mqtt: getMqttStatus(),
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

export default router;
