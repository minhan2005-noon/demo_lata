import { Router } from "express";
import { addLog } from "../store.js";
import { findDevice, findPump } from "../services/devices.service.js";
import { fail, ok } from "../utils/http.js";

const router = Router();

router.post("/:deviceId/pumps/:pumpId/start", (req, res) => {
  const { device, pump } = findPump(req.params.deviceId, req.params.pumpId);
  if (!device) return fail(res, 404, "DEVICE_NOT_FOUND", "Device not found.");
  if (!pump) return fail(res, 404, "PUMP_NOT_FOUND", "Pump not found.");

  pump.status = "running";
  pump.startedAt = new Date().toISOString();
  pump.stoppedAt = null;

  const log = addLog({
    deviceId: device.id,
    type: "PUMP_STARTED",
    message: `Pump ${pump.id} started.`
  });

  ok(res, { deviceId: device.id, pump, log });
});

router.post("/:deviceId/pumps/:pumpId/stop", (req, res) => {
  const { device, pump } = findPump(req.params.deviceId, req.params.pumpId);
  if (!device) return fail(res, 404, "DEVICE_NOT_FOUND", "Device not found.");
  if (!pump) return fail(res, 404, "PUMP_NOT_FOUND", "Pump not found.");

  pump.status = "stopped";
  pump.stoppedAt = new Date().toISOString();

  const log = addLog({
    deviceId: device.id,
    type: "PUMP_STOPPED",
    message: `Pump ${pump.id} stopped.`
  });

  ok(res, { deviceId: device.id, pump, log });
});

router.get("/:deviceId/pumps/status", (req, res) => {
  const device = findDevice(req.params.deviceId);
  if (!device) return fail(res, 404, "DEVICE_NOT_FOUND", "Device not found.");

  ok(res, device.pumps, { count: device.pumps.length, deviceId: device.id });
});

export default router;
