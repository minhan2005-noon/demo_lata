import crypto from "node:crypto";
import cors from "cors";

const splitList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toBuffer = (value) => Buffer.from(String(value || ""), "utf8");

const constantTimeEquals = (actual, expected) => {
  const actualBuffer = toBuffer(actual);
  const expectedBuffer = toBuffer(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const extractApiKey = (req) => {
  const headerKey = req.get("x-api-key");
  if (headerKey) return headerKey;

  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
};

export const corsMiddleware = () => {
  const allowedOrigins = splitList(process.env.CORS_ORIGINS);

  return cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (!allowedOrigins.length) return callback(null, process.env.NODE_ENV !== "production");
      return callback(null, allowedOrigins.includes(origin));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Session-Token"],
    maxAge: 600
  });
};

export const rateLimitMiddleware = () => {
  const windowMs = parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
  const maxRequests = parsePositiveInt(process.env.RATE_LIMIT_MAX, 120);
  const clients = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = extractApiKey(req) || req.ip || req.socket.remoteAddress || "unknown";
    const record = clients.get(key);

    if (!record || record.resetAt <= now) {
      clients.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    record.count += 1;
    if (record.count <= maxRequests) return next();

    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Try again later."
      }
    });
  };
};

export const requireApiKey = (req, res, next) => {
  const expectedApiKey = process.env.API_KEY;

  if (!expectedApiKey) {
    if (process.env.NODE_ENV === "production") {
      return res.status(500).json({
        success: false,
        error: {
          code: "SECURITY_MISCONFIGURED",
          message: "API_KEY must be configured in production."
        }
      });
    }

    return next();
  }

  const actualApiKey = extractApiKey(req);
  if (actualApiKey && constantTimeEquals(actualApiKey, expectedApiKey)) return next();

  return res.status(401).json({
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Valid API key is required."
    }
  });
};
