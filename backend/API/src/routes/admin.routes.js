import { Router } from "express";
import { deleteTelemetryReadings } from "../services/influx.service.js";
import { sensorReadings } from "../store.js";
import { ok } from "../utils/http.js";

const router = Router();

router.delete("/measurements", async (req, res, next) => {
  try {
    const memoryDeletedCount = sensorReadings.length;
    sensorReadings.length = 0;

    let result;
    try {
      result = await deleteTelemetryReadings();
    } catch (error) {
      console.warn("Memory readings were deleted, but InfluxDB delete failed:", error.message);
      result = {
        enabled: true,
        deleted: false,
        error: error.code || error.message || "INFLUX_DELETE_FAILED"
      };
    }

    return ok(res, result, {
      message: result.deleted
        ? "Measurement data deleted."
        : `Memory measurement data deleted (${memoryDeletedCount} reading(s)); InfluxDB is unavailable.`
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
