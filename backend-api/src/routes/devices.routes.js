import { Router } from "express";
import { listDevices, findDevice } from "../services/devices.service.js";
import { fail, ok } from "../utils/http.js";

const router = Router();

router.get("/", (req, res) => {
  const result = listDevices({ status: req.query.status });
  ok(res, result, { count: result.length });
});

router.get("/:id", (req, res) => {
  const device = findDevice(req.params.id);
  if (!device) return fail(res, 404, "DEVICE_NOT_FOUND", "Device not found.");
  return ok(res, device);
});

export default router;
