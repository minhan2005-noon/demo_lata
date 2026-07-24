import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import adminRoutes from "./routes/admin.routes.js";
import alertsRoutes from "./routes/alerts.routes.js";
import devicesRoutes from "./routes/devices.routes.js";
import healthRoutes from "./routes/health.routes.js";
import logsRoutes from "./routes/logs.routes.js";
import pumpsRoutes from "./routes/pumps.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import sensorsRoutes from "./routes/sensors.routes.js";
import { corsMiddleware, rateLimitMiddleware, requireApiKey } from "./middleware/security.js";
import { fail } from "./utils/http.js";

const app = express();

if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.set("etag", false);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "same-site" }
  })
);
app.use(corsMiddleware());
app.use(rateLimitMiddleware());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const apiIndex = {
  service: "lata-api",
  status: "ok",
  endpoints: {
    health: "GET /api/health",
    devices: ["GET /api/devices", "GET /api/devices/:id"],
    sensors: [
      "GET /api/sensors/latest",
      "GET /api/sensors/:sensorId/history?start=...&end=...",
      "POST /api/sensors/data"
    ],
    pumps: [
      "POST /api/devices/:deviceId/pumps/:pumpId/start",
      "POST /api/devices/:deviceId/pumps/:pumpId/stop",
      "GET /api/devices/:deviceId/pumps/status"
    ],
    alerts: "GET /api/alerts?status=active",
    logs: "GET /api/logs?deviceId=...&limit=100",
    reports: "GET /api/reports/daily?date=2026-07-06",
    admin: "DELETE /api/admin/measurements",
    auth: "GET /api/auth/verify"
  }
};

app.get("/", (req, res) => {
  res.json({ success: true, data: apiIndex });
});

app.get("/api", (req, res) => {
  res.json({ success: true, data: apiIndex });
});

app.use("/api/health", healthRoutes);
app.get("/api/auth/verify", requireApiKey, (req, res) => {
  res.json({ success: true, data: { authenticated: true } });
});
app.use("/api/devices", devicesRoutes);
app.use("/api/sensors", sensorsRoutes);
app.use("/api/devices", requireApiKey, pumpsRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/admin", requireApiKey, adminRoutes);

app.use((req, res) => {
  fail(res, 404, "ROUTE_NOT_FOUND", "API route not found.");
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  const code = error.code || "INTERNAL_ERROR";
  const message = status === 500 ? "Unexpected server error." : error.message;
  fail(res, status, code, message);
});

export default app;
