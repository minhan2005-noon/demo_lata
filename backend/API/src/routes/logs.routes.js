import { Router } from "express";
import { logs } from "../store.js";
import { fail, ok } from "../utils/http.js";

const router = Router();

router.get("/", (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  if (!Number.isInteger(limit) || limit < 1) {
    return fail(res, 400, "INVALID_LIMIT", "limit must be a positive integer.");
  }

  let result = logs;
  if (req.query.deviceId) {
    result = result.filter((log) => log.deviceId === req.query.deviceId);
  }

  result = result
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);

  ok(res, result, { count: result.length, limit });
});

export default router;
