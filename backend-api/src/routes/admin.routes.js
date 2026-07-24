import { Router } from "express";
import { deleteTelemetryReadings } from "../services/influx.service.js";
import { ok } from "../utils/http.js";

const router = Router();

router.delete("/measurements", async (req, res, next) => {
  try {
    const result = await deleteTelemetryReadings();
    return ok(res, result, {
      message: result.deleted ? "Measurement data deleted." : "InfluxDB is not enabled."
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
