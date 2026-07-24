import { Router } from "express";
import { alerts } from "../store.js";
import { ok } from "../utils/http.js";

const router = Router();

router.get("/", (req, res) => {
  const { status, deviceId, severity } = req.query;
  let result = alerts;

  if (status) result = result.filter((alert) => alert.status === status);
  if (deviceId) result = result.filter((alert) => alert.deviceId === deviceId);
  if (severity) result = result.filter((alert) => alert.severity === severity);

  ok(res, result, { count: result.length });
});

export default router;
