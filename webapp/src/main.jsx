import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const defaultApiBase =
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.port === "5173" ? "http://localhost:8000" : "");
const hasLegacyApiBase = () => Boolean(localStorage.getItem("lata.apiBase"));
const minuteMs = 60 * 1000;
const lockDurationMs = 60 * 1000;
const maxLoginAttempts = 3;

const sensorLabels = {
  ph: "pH",
  temperature: "Nhiệt độ",
  cod: "COD",
  bod: "BOD",
  toc: "TOC",
  dissolved_oxygen: "DO",
  electrical_conductivity: "EC",
  color: "Màu",
  ammonium: "Amoni",
  tss: "TSS"
};

const sensorCatalog = [
  { id: "ph-001", type: "ph", unit: "pH", min: 5.8, max: 8.8, standardMin: 6.0, standardMax: 8.5, acceptedMin: 5.5, acceptedMax: 9.0, baseline: 7.2, volatility: 0.08 },
  { id: "temp-001", type: "temperature", unit: "C", min: 25, max: 39, standardMin: 25, standardMax: 37, acceptedMin: 20, acceptedMax: 40, baseline: 30.4, volatility: 0.25 },
  { id: "cod-001", type: "cod", unit: "mg/L", min: 80, max: 220, standardMin: 0, standardMax: 150, acceptedMin: 0, acceptedMax: 180, baseline: 166, volatility: 5 },
  { id: "bod-001", type: "bod", unit: "mg/L", min: 24, max: 80, standardMin: 0, standardMax: 50, acceptedMin: 0, acceptedMax: 65, baseline: 58, volatility: 2.4 },
  { id: "toc-001", type: "toc", unit: "mg/L", min: 18, max: 68, standardMin: 0, standardMax: 50, acceptedMin: 0, acceptedMax: 60, baseline: 34, volatility: 1.8 },
  { id: "do-001", type: "dissolved_oxygen", unit: "mg/L", min: 2.2, max: 6.6, standardMin: 2, standardMax: 8, acceptedMin: 1.5, acceptedMax: 9, baseline: 3.8, volatility: 0.14 },
  { id: "ec-001", type: "electrical_conductivity", unit: "mS/cm", min: 1.2, max: 4.8, standardMin: 0, standardMax: 5, acceptedMin: 0, acceptedMax: 6, baseline: 2.4, volatility: 0.12 },
  { id: "color-001", type: "color", unit: "Pt-Co", min: 48, max: 170, standardMin: 0, standardMax: 150, acceptedMin: 0, acceptedMax: 180, baseline: 92, volatility: 3 },
  { id: "nh4-001", type: "ammonium", unit: "mg/L", min: 2.2, max: 12, standardMin: 0, standardMax: 10, acceptedMin: 0, acceptedMax: 12, baseline: 11.1, volatility: 0.28 },
  { id: "tss-001", type: "tss", unit: "mg/L", min: 42, max: 150, standardMin: 0, standardMax: 100, acceptedMin: 0, acceptedMax: 130, baseline: 116, volatility: 3.8 }
];

const rangeOptions = [
  { id: "day", label: "Ngày", points: 48, stepMs: 30 * 60 * 1000 },
  { id: "month", label: "Tháng", points: 30, stepMs: 24 * 60 * 60 * 1000 },
  { id: "year", label: "Năm", points: 12, stepMs: 30 * 24 * 60 * 60 * 1000 }
];

const roundValue = (value, type) => Number(value.toFixed(["ph", "dissolved_oxygen", "electrical_conductivity"].includes(type) ? 2 : 1));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function randomBetween(min, max) {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

function randomBelow(min, floor, margin) {
  return randomBetween(floor, Math.max(floor, min - Math.abs(margin)));
}

function randomAbove(max, ceiling, margin) {
  return randomBetween(Math.min(ceiling, max + Math.abs(margin)), ceiling);
}

function generateSensorValue(sensor) {
  const roll = Math.random();
  const standardMin = sensor.standardMin;
  const standardMax = sensor.standardMax;
  const acceptedMin = sensor.acceptedMin ?? standardMin;
  const acceptedMax = sensor.acceptedMax ?? standardMax;
  const margin = Math.max(sensor.volatility * 4, (standardMax - standardMin || sensor.volatility) * 0.12);

  if (roll < 0.6) {
    return roundValue(randomBetween(standardMin, standardMax), sensor.type);
  }

  if (roll < 0.8) {
    const canGoLow = acceptedMin < standardMin;
    const canGoHigh = acceptedMax > standardMax;
    const goLow = canGoLow && (!canGoHigh || Math.random() < 0.5);
    if (goLow) return roundValue(randomBetween(acceptedMin, standardMin), sensor.type);
    return roundValue(randomBetween(standardMax, acceptedMax), sensor.type);
  }

  const canGoLow = sensor.min < acceptedMin;
  const canGoHigh = sensor.max > acceptedMax;
  const goLow = canGoLow && (!canGoHigh || Math.random() < 0.5);
  if (goLow) return roundValue(randomBelow(acceptedMin, sensor.min, margin), sensor.type);
  return roundValue(randomAbove(acceptedMax, sensor.max, margin), sensor.type);
}

function makeSeries(sensor, rangeId) {
  const range = rangeOptions.find((option) => option.id === rangeId) || rangeOptions[0];
  const now = Date.now();

  return Array.from({ length: range.points }, (_, index) => {
    return {
      timestamp: new Date(now - (range.points - index - 1) * range.stepMs).toISOString(),
      value: generateSensorValue(sensor)
    };
  });
}

function makeSimulation(rangeId) {
  return Object.fromEntries(sensorCatalog.map((sensor) => [sensor.id, makeSeries(sensor, rangeId)]));
}

function nextPoint(sensor, previous, rangeId) {
  const range = rangeOptions.find((option) => option.id === rangeId) || rangeOptions[0];
  return {
    timestamp: new Date().toISOString(),
    value: generateSensorValue(sensor),
    range,
  };
}

function latestFromSimulation(seriesBySensor) {
  return sensorCatalog.map((sensor) => {
    const latest = seriesBySensor[sensor.id]?.at(-1);
    return {
      sensorId: sensor.id,
      deviceId: "lata-001",
      type: sensor.type,
      value: latest?.value ?? sensor.baseline,
      unit: sensor.unit,
      timestamp: latest?.timestamp || new Date().toISOString()
    };
  });
}

function advanceSimulation(seriesBySensor, rangeId) {
  const timestamp = new Date().toISOString();
  const next = {};
  const readings = [];

  for (const sensor of sensorCatalog) {
    const currentSeries = seriesBySensor[sensor.id] || makeSeries(sensor, rangeId);
    const value = generateSensorValue(sensor);
    next[sensor.id] = [...currentSeries.slice(1), { timestamp, value }];
    readings.push({
      sensorId: sensor.id,
      deviceId: "lata-001",
      value,
      timestamp
    });
  }

  return { next, readings, timestamp };
}

function analyzeSimulation(seriesBySensor) {
  return sensorCatalog.map((sensor) => {
    const series = seriesBySensor[sensor.id] || [];
    const values = series.map((point) => point.value);
    const latest = values.at(-1) ?? sensor.baseline;
    const min = values.length ? Math.min(...values) : latest;
    const max = values.length ? Math.max(...values) : latest;
    const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : latest;
    const lowerDeviation = Math.max(0, sensor.standardMin - min, sensor.standardMin - latest);
    const upperDeviation = Math.max(0, max - sensor.standardMax, latest - sensor.standardMax);
    const deviation = roundValue(Math.max(lowerDeviation, upperDeviation), sensor.type);
    const passed = deviation === 0;
    const acceptedMin = sensor.acceptedMin ?? sensor.standardMin;
    const acceptedMax = sensor.acceptedMax ?? sensor.standardMax;
    const accepted = latest >= acceptedMin && latest <= acceptedMax;
    const severeLowerDeviation = Math.max(0, acceptedMin - latest);
    const severeUpperDeviation = Math.max(0, latest - acceptedMax);
    const severeDeviation = roundValue(Math.max(severeLowerDeviation, severeUpperDeviation), sensor.type);
    const severe = severeDeviation > 0;
    const direction = lowerDeviation > upperDeviation ? "thấp hơn chuẩn" : "cao hơn chuẩn";
    const baseLimit = lowerDeviation > upperDeviation ? sensor.standardMin : sensor.standardMax;
    const deviationPercent = baseLimit ? Number(((deviation / baseLimit) * 100).toFixed(1)) : 0;

    return {
      sensor,
      latest: roundValue(latest, sensor.type),
      min: roundValue(min, sensor.type),
      max: roundValue(max, sensor.type),
      avg: roundValue(avg, sensor.type),
      accepted,
      deviation,
      deviationPercent,
      direction,
      passed,
      severe,
      severeDeviation
    };
  });
}

function toDateTimeLocal(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * minuteMs);
  return local.toISOString().slice(0, 16);
}

function formatTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours} giờ ${minutes} phút`;
  if (minutes) return `${minutes} phút ${seconds} giây`;
  return `${seconds} giây`;
}

function getScheduleState(schedule, nowMs) {
  const startMs = new Date(schedule.startAt).getTime();
  const stopMs = new Date(schedule.stopAt).getTime();
  if (schedule.lastError) return { label: "lỗi", className: "danger", detail: schedule.lastError };
  if (schedule.startPending) return { label: "đang bật", className: "stopping", detail: "Đang gửi lệnh bật bơm" };
  if (schedule.stopPending) return { label: "đang tắt", className: "stopping", detail: "Đang gửi lệnh tắt bơm" };
  if (!schedule.enabled && schedule.stopExecuted) return { label: "hoàn tất", className: "done", detail: "Đã kết thúc lịch bơm" };
  if (nowMs < startMs) return { label: "đang chờ", className: "waiting", detail: `Bật sau ${formatDuration(startMs - nowMs)}` };
  if (nowMs >= startMs && nowMs < stopMs && schedule.startExecuted) {
    return { label: "đang bơm", className: "running", detail: `Tắt sau ${formatDuration(stopMs - nowMs)}` };
  }
  if (nowMs >= startMs && nowMs < stopMs) {
    return { label: "đến giờ bật", className: "stopping", detail: "Đang chờ lệnh bật bơm" };
  }
  return { label: "đến giờ tắt", className: "stopping", detail: "Đang chờ lệnh tắt bơm" };
}

function canRetrySchedule(schedule, nowMs) {
  if (!schedule.lastErrorAt) return true;
  return nowMs - new Date(schedule.lastErrorAt).getTime() > 10_000;
}

function isSamplingPump(pump) {
  const text = `${pump?.id || ""} ${pump?.name || ""}`.toLowerCase();
  return text.includes("sample") || text.includes("sampling") || text.includes("thu thap") || text.includes("lấy mẫu");
}

function isDrainPump(pump) {
  const text = `${pump?.id || ""} ${pump?.name || ""}`.toLowerCase();
  return text.includes("drain") || text.includes("xả") || text.includes("xa");
}

function App() {
  const [apiBase] = useState(defaultApiBase);
  const [apiKey, setApiKey] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(() => (hasLegacyApiBase() ? 0 : Number(localStorage.getItem("lata.loginAttempts") || 0)));
  const [lockUntil, setLockUntil] = useState(() => (hasLegacyApiBase() ? 0 : Number(localStorage.getItem("lata.lockUntil") || 0)));
  const [activePage, setActivePage] = useState("status");
  const [loading, setLoading] = useState(false);
  const [rangeId, setRangeId] = useState("day");
  const [simulation, setSimulation] = useState(() => makeSimulation("day"));
  const simulationRef = useRef(simulation);
  const autoWriteRef = useRef(false);
  const [lastSimulatedAt, setLastSimulatedAt] = useState(() => new Date().toISOString());
  const [sampleTicks, setSampleTicks] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [schedules, setSchedules] = useState(() => JSON.parse(localStorage.getItem("lata.pumpSchedules") || "[]"));
  const [scheduleForm, setScheduleForm] = useState(() => {
    const now = new Date();
    return {
      deviceId: "lata-001",
      pumpId: "pump-01",
      startAt: toDateTimeLocal(new Date(now.getTime() + minuteMs)),
      stopAt: toDateTimeLocal(new Date(now.getTime() + 6 * minuteMs)),
      note: "Bơm lấy mẫu"
    };
  });
  const [actionState, setActionState] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState({
    health: null,
    devices: [],
    latest: [],
    alerts: [],
    logs: [],
    report: null
  });
  const allPumps = useMemo(
    () => data.devices.flatMap((device) => (device.pumps || []).map((pump) => ({ ...pump, deviceId: device.id }))),
    [data.devices]
  );
  const runningPumps = allPumps.filter((pump) => pump.status === "running");
  const runningSamplingPumps = runningPumps.filter(isSamplingPump);
  const isSamplingActive = runningSamplingPumps.length > 0;
  const visibleReadings = latestFromSimulation(simulation);
  const analysisRows = analyzeSimulation(simulation);
  const passedCount = analysisRows.filter((row) => row.passed).length;
  const failedCount = analysisRows.length - passedCount;
  const acceptedCount = analysisRows.filter((row) => !row.passed && row.accepted).length;
  const severeCount = analysisRows.filter((row) => row.severe).length;
  const currentSevereCount = analysisRows.filter((row) => row.severe).length;
  const sampleReady = isSamplingActive && sampleTicks >= 3;

  const headers = useMemo(() => {
    const result = { "Content-Type": "application/json" };
    if (apiKey) result["X-API-Key"] = apiKey;
    return result;
  }, [apiKey]);

  const request = useCallback(
    async (path, options = {}) => {
      const { timeoutMs = 6000, ...fetchOptions } = options;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetch(`${apiBase}${path}`, {
          ...fetchOptions,
          cache: "no-store",
          signal: controller.signal,
          headers: { ...headers, ...(fetchOptions.headers || {}) }
        });
      } catch (err) {
        if (err.name === "AbortError") throw new Error("Máy chủ phản hồi quá lâu.");
        throw err;
      } finally {
        window.clearTimeout(timeout);
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || `HTTP ${response.status}`);
      }
      return payload?.data;
    },
    [apiBase, headers]
  );

  const updateLocalPump = useCallback((deviceId, pumpId, status) => {
    setData((current) => ({
      ...current,
      devices: current.devices.map((device) =>
        device.id === deviceId
          ? {
              ...device,
              pumps: (device.pumps || []).map((pump) =>
                pump.id === pumpId
                  ? {
                      ...pump,
                      status,
                      startedAt: status === "running" ? new Date().toISOString() : pump.startedAt,
                      stoppedAt: status === "stopped" ? new Date().toISOString() : pump.stoppedAt
                    }
                  : pump
              )
            }
          : device
      )
    }));
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [healthResult, devicesResult, latestResult, alertsResult, logsResult, reportResult] = await Promise.allSettled([
        request("/api/health"),
        request("/api/devices"),
        request("/api/sensors/latest"),
        request("/api/alerts?status=active"),
        request("/api/logs?limit=8"),
        request(`/api/reports/daily?date=${today}`)
      ]);

      const health = healthResult.status === "fulfilled" ? healthResult.value : null;
      const devices = devicesResult.status === "fulfilled" ? devicesResult.value : [];
      const latest = latestResult.status === "fulfilled" ? latestResult.value : [];
      const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];
      const logs = logsResult.status === "fulfilled" ? logsResult.value : [];
      const report = reportResult.status === "fulfilled" ? reportResult.value : null;
      const failedCritical = devicesResult.status === "rejected" ? devicesResult.reason?.message || "Không tải được thiết bị." : "";

      setData({
        health: health || null,
        devices: devices || [],
        latest: latest || [],
        alerts: alerts || [],
        logs: logs || [],
        report: report || null
      });
      if (failedCritical) setError(failedCritical);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const hadLegacyApiBase = hasLegacyApiBase();
    localStorage.removeItem("lata.apiBase");
    localStorage.removeItem("lata.apiKey");
    if (hadLegacyApiBase) {
      localStorage.removeItem("lata.loginAttempts");
      localStorage.removeItem("lata.lockUntil");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("lata.pumpSchedules", JSON.stringify(schedules));
  }, [schedules]);

  useEffect(() => {
    if (isAuthenticated) loadStatus();
  }, [isAuthenticated, loadStatus]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const isLocked = lockUntil > nowMs;
  const lockSeconds = Math.max(0, Math.ceil((lockUntil - nowMs) / 1000));

  async function verifyAdminCode(event) {
    event.preventDefault();
    if (isLocked || authLoading) return;

    const code = authCode.trim();
    if (!code) {
      setAuthError("Nhập mã quản trị để tiếp tục.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 6000);
      const response = await fetch(`${apiBase}/api/auth/verify`, {
        headers: { "X-API-Key": code },
        signal: controller.signal
      }).finally(() => window.clearTimeout(timeout));

      if (!response.ok) throw new Error("Mã quản trị không đúng.");

      setApiKey(code);
      setIsAuthenticated(true);
      setAuthCode("");
      setLoginAttempts(0);
      setLockUntil(0);
      localStorage.setItem("lata.loginAttempts", "0");
      localStorage.removeItem("lata.lockUntil");
      await loadStatus();
    } catch (err) {
      const nextAttempts = loginAttempts + 1;
      if (nextAttempts >= maxLoginAttempts) {
        const nextLockUntil = Date.now() + lockDurationMs;
        setLockUntil(nextLockUntil);
        setLoginAttempts(0);
        localStorage.setItem("lata.loginAttempts", "0");
        localStorage.setItem("lata.lockUntil", String(nextLockUntil));
        setAuthError("Nhập sai quá nhiều lần. Vui lòng đợi 1 phút.");
      } else {
        setLoginAttempts(nextAttempts);
        localStorage.setItem("lata.loginAttempts", String(nextAttempts));
        setAuthError(`${err.name === "AbortError" ? "Máy chủ phản hồi quá lâu." : err.message} Còn ${maxLoginAttempts - nextAttempts} lần thử.`);
      }
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    const nextSimulation = makeSimulation(rangeId);
    simulationRef.current = nextSimulation;
    setSimulation(nextSimulation);
    setLastSimulatedAt(new Date().toISOString());
  }, [rangeId]);

  useEffect(() => {
    simulationRef.current = simulation;
  }, [simulation]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!isSamplingActive) return;

      const { next, readings, timestamp } = advanceSimulation(simulationRef.current, rangeId);
      simulationRef.current = next;
      setSimulation(next);
      setLastSimulatedAt(timestamp);
      setSampleTicks((current) => Math.min(3, current + 1));

      if (!apiKey || autoWriteRef.current) return;

      autoWriteRef.current = true;
      request("/api/sensors/data", {
        method: "POST",
        body: JSON.stringify({ deviceId: "lata-001", readings })
      })
        .then(() => {
          setActionState(`Đã tự động ghi ${readings.length} chỉ số vào dữ liệu lưu trữ.`);
        })
        .catch((err) => {
          setError(`Tự động ghi số liệu: ${err.message}`);
        })
        .finally(() => {
          autoWriteRef.current = false;
        });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [apiKey, isSamplingActive, rangeId, request]);

  useEffect(() => {
    if (!isSamplingActive) setSampleTicks(0);
  }, [isSamplingActive]);

  async function sendTelemetry() {
    setActionState("Đang gửi số liệu mẫu...");
    setError("");
    try {
      const sentAt = new Date().toISOString();
      const readings = latestFromSimulation(simulation).map((reading) => ({
        sensorId: reading.sensorId,
        deviceId: reading.deviceId,
        value: reading.value,
        timestamp: sentAt
      }));
      await request("/api/sensors/data", {
        method: "POST",
        body: JSON.stringify({ deviceId: "lata-001", readings })
      });
      setActionState(`Đã ghi nhận ${readings.length} chỉ số mẫu.`);
      await loadStatus();
    } catch (err) {
      setActionState("");
      setError(err.message);
    }
  }

  async function deleteMeasurements() {
    const confirmed = window.confirm("Xóa toàn bộ dữ liệu đo đã lưu? Thao tác này không thể hoàn tác.");
    if (!confirmed) return;

    setActionState("Đang xóa dữ liệu đo...");
    setError("");
    try {
      await request("/api/admin/measurements", { method: "DELETE" });
      setActionState("Đã xóa dữ liệu đo trong InfluxDB.");
      await loadStatus();
    } catch (err) {
      setActionState("");
      setError(err.message);
    }
  }

  async function setPump(deviceId, pumpId, command) {
    const targetPump = allPumps.find((pump) => pump.deviceId === deviceId && pump.id === pumpId);
    if (command === "start" && isDrainPump(targetPump)) {
      setError("Bơm xả chỉ được tự động bật khi mẫu đạt yêu cầu.");
      return;
    }

    setActionState(`${command === "start" ? "Đang bật" : "Đang tắt"} ${pumpId}...`);
    setError("");
    try {
      await request(`/api/devices/${deviceId}/pumps/${pumpId}/${command}`, { method: "POST" });
      updateLocalPump(deviceId, pumpId, command === "start" ? "running" : "stopped");
      setActionState(`Bơm ${pumpId} đã ${command === "start" ? "bật" : "tắt"}.`);
      await loadStatus();
    } catch (err) {
      setActionState("");
      setError(err.message);
    }
  }

  useEffect(() => {
    const drainPumps = allPumps.filter(isDrainPump);
    if (!drainPumps.length || !apiKey) return;

    const shouldDrain = sampleReady && currentSevereCount === 0;
    const actions = drainPumps
      .filter((pump) => (shouldDrain ? pump.status !== "running" : pump.status === "running"))
      .map((pump) => ({
        deviceId: pump.deviceId,
        pumpId: pump.id,
        command: shouldDrain ? "start" : "stop"
      }));

    if (!actions.length) return;

    actions.forEach(async (action) => {
      try {
        await request(`/api/devices/${action.deviceId}/pumps/${action.pumpId}/${action.command}`, { method: "POST" });
        setActionState(
          shouldDrain
            ? "Mẫu đã đo xong và nằm trong khoảng cho phép, hệ thống đã tự động bật bơm xả."
            : currentSevereCount > 0
              ? "Thông số vượt ngoài khoảng chấp nhận, hệ thống đã tự động ngắt bơm xả."
              : sampleReady
                ? "Mẫu còn sai lệch nhẹ trong khoảng chấp nhận, hệ thống vẫn cho phép xả."
              : "Đang chờ kết quả đo mẫu, bơm xả chưa được phép chạy."
        );
        await loadStatus();
      } catch (err) {
        setError(`Tự động điều khiển bơm xả: ${err.message}`);
      }
    });
  }, [allPumps, apiKey, currentSevereCount, loadStatus, request, sampleReady]);

  const runScheduledPump = useCallback(
    async (schedule, command) => {
      setActionState(`${command === "start" ? "Đang gửi lệnh bật" : "Đang gửi lệnh tắt"} ${schedule.pumpId} theo lịch.`);

      if (!apiKey) {
        setSchedules((current) =>
          current.map((item) =>
            item.id === schedule.id
              ? {
                  ...item,
                  startPending: command === "start" ? false : item.startPending,
                  stopPending: command === "stop" ? false : item.stopPending,
                  lastError: "Chưa nhập mã quản trị",
                  lastErrorAt: new Date().toISOString()
                }
              : item
          )
        );
        setError("Nhập mã quản trị trước khi lịch tự bật/tắt bơm.");
        return;
      }

      try {
        await request(`/api/devices/${schedule.deviceId}/pumps/${schedule.pumpId}/${command}`, { method: "POST" });
        updateLocalPump(schedule.deviceId, schedule.pumpId, command === "start" ? "running" : "stopped");
        setSchedules((current) =>
          current.map((item) => {
            if (item.id !== schedule.id) return item;
            if (command === "start") {
              return { ...item, startExecuted: true, startPending: false, lastError: "" };
            }
            return { ...item, stopExecuted: true, stopPending: false, enabled: false, lastError: "" };
          })
        );
        setActionState(`${command === "start" ? "Đã bật" : "Đã tắt"} ${schedule.pumpId} theo lịch.`);
        await loadStatus();
      } catch (err) {
        setSchedules((current) =>
          current.map((item) =>
            item.id === schedule.id
              ? {
                  ...item,
                  startPending: command === "start" ? false : item.startPending,
                  stopPending: command === "stop" ? false : item.stopPending,
                  lastError: err.message,
                  lastErrorAt: new Date().toISOString()
                }
              : item
          )
        );
        setError(`Lịch ${schedule.note || schedule.pumpId}: ${err.message}`);
      }
    },
    [apiKey, loadStatus, request, updateLocalPump]
  );

  useEffect(() => {
    const dueActions = schedules
      .filter((schedule) => schedule.enabled && canRetrySchedule(schedule, nowMs))
      .map((schedule) => {
        const startMs = new Date(schedule.startAt).getTime();
        const stopMs = new Date(schedule.stopAt).getTime();

        if (nowMs >= stopMs && !schedule.stopExecuted && !schedule.stopPending) {
          return { schedule, command: "stop" };
        }

        if (nowMs >= startMs && nowMs < stopMs && !schedule.startExecuted && !schedule.startPending) {
          return { schedule, command: "start" };
        }

        return null;
      })
      .filter(Boolean);

    if (!dueActions.length) return;

    setSchedules((current) =>
      current.map((schedule) => {
        const action = dueActions.find((item) => item.schedule.id === schedule.id);
        if (!action) return schedule;
        return {
          ...schedule,
          startPending: action.command === "start" ? true : schedule.startPending,
          stopPending: action.command === "stop" ? true : schedule.stopPending,
          lastError: ""
        };
      })
    );

    dueActions.forEach(({ schedule, command }) => runScheduledPump(schedule, command));
  }, [nowMs, runScheduledPump, schedules]);

  function addSchedule(event) {
    event.preventDefault();
    setError("");

    const startAt = new Date(scheduleForm.startAt);
    const stopAt = new Date(scheduleForm.stopAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(stopAt.getTime())) {
      setError("Thời gian đặt lịch chưa hợp lệ.");
      return;
    }
    if (stopAt <= startAt) {
      setError("Giờ ngừng nước phải sau giờ bơm nước.");
      return;
    }
    const selectedPump = pumpOptions.find((pump) => pump.id === scheduleForm.pumpId);
    if (!selectedPump || !isSamplingPump(selectedPump)) {
      setError("Chỉ được đặt lịch cho bơm thu thập mẫu.");
      return;
    }
    if (startAt.getTime() < Date.now() + minuteMs) {
      setError("Giờ bơm nước phải được đặt trước thời điểm bắt đầu ít nhất 1 phút.");
      return;
    }

    const schedule = {
      id: `schedule-${Date.now()}`,
      ...scheduleForm,
      startAt: startAt.toISOString(),
      stopAt: stopAt.toISOString(),
      enabled: true,
      startExecuted: false,
      stopExecuted: false,
      createdAt: new Date().toISOString()
    };

    setSchedules((current) => [schedule, ...current]);
    setActionState("Đã thêm lịch bơm.");
  }

  function removeSchedule(scheduleId) {
    setSchedules((current) => current.filter((schedule) => schedule.id !== scheduleId));
  }

  const onlineCount = data.devices.filter((device) => device.status === "online").length;
  const selectedDevice = data.devices.find((device) => device.id === scheduleForm.deviceId) || data.devices[0];
  const pumpOptions = (selectedDevice?.pumps || []).filter(isSamplingPump);

  if (!isAuthenticated) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-mark auth-brand">
            <span>L</span>
            <div>
              <strong>LATA</strong>
              <small>Quản trị trạm nước</small>
            </div>
          </div>
          <div>
            <p className="eyebrow">Xác thực quản trị</p>
            <h1>Nhập mã để vào hệ thống</h1>
            <p className="header-copy">ok</p>
          </div>
          <form className="auth-form" onSubmit={verifyAdminCode}>
            <label>
              Mã quản trị
              <input
                autoFocus
                disabled={isLocked || authLoading}
                type="password"
                value={authCode}
                onChange={(event) => setAuthCode(event.target.value)}
                placeholder={isLocked ? `Đợi ${lockSeconds}s` : "Nhập mã quản trị"}
              />
            </label>
            <button className="primary-btn" disabled={isLocked || authLoading} type="submit">
              {isLocked ? `Đợi ${lockSeconds}s` : authLoading ? "Đang kiểm tra..." : "Vào hệ thống"}
            </button>
          </form>
          {authError && <div className="notice error auth-notice">{authError}</div>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <span>L</span>
          <div>
            <strong>LATA</strong>
            <small>Water Station</small>
          </div>
        </div>
        <nav className="side-nav" aria-label="Khu vực quản trị">
          <button className={activePage === "status" ? "active" : ""} onClick={() => setActivePage("status")}>Trạng thái</button>
          <button className={activePage === "schedule" ? "active" : ""} onClick={() => setActivePage("schedule")}>Lịch bơm</button>
          <button className={activePage === "summary" ? "active" : ""} onClick={() => setActivePage("summary")}>Thống kê tổng quát</button>
        </nav>
        <div className="side-footer">
          <span>Quy trình xả</span>
          <strong>{sampleReady ? "Đã đủ mẫu" : `${sampleTicks}/3 mẫu`}</strong>
        </div>
      </aside>

      <section className="workspace">
        <section className="command-header">
          <div>
            <p className="eyebrow">Quản trị hệ thống</p>
            <h1>Trạng thái vận hành LATA</h1>
            <p className="header-copy">Theo dõi trạm quan trắc, cảm biến, cảnh báo và bơm lấy mẫu. Khi chưa có thiết bị thật, số liệu được mô phỏng và tự cập nhật sau mỗi 5 giây.</p>
          </div>
          <div className="header-actions">
            <div className="verified-badge">
              <span>Đã xác thực</span>
              <strong>Quản trị</strong>
            </div>
            <button className="primary-btn" onClick={loadStatus} disabled={loading}>
              {loading ? "Đang tải..." : "Cập nhật"}
            </button>
            <button
              onClick={() => {
                setApiKey("");
                setIsAuthenticated(false);
              }}
            >
              Thoát
            </button>
          </div>
        </section>

      <section className="control-strip" aria-label="Cấu hình kết nối">
        <div className="connection-note">
          <strong>Kết nối nội bộ</strong>
          <small>Máy chủ được cấu hình sẵn cho trạm quản trị.</small>
        </div>
        <div className="control-actions">
          <button onClick={sendTelemetry}>Gửi số liệu mẫu</button>
          <button className="danger-btn" onClick={deleteMeasurements}>Xóa dữ liệu đo</button>
        </div>
      </section>

      {(error || actionState) && (
        <div className={error ? "notice error" : "notice"}>
          {error || actionState}
        </div>
      )}

      {activePage === "schedule" ? (
        <SchedulePage
          devices={data.devices}
          pumpOptions={pumpOptions}
          form={scheduleForm}
          nowMs={nowMs}
          schedules={schedules}
          onChangeForm={setScheduleForm}
          onAddSchedule={addSchedule}
          onRemoveSchedule={removeSchedule}
        />
      ) : activePage === "summary" ? (
        <SummaryPage
          analysisRows={analysisRows}
          acceptedCount={acceptedCount}
          failedCount={failedCount}
          isSamplingActive={isSamplingActive}
          passedCount={passedCount}
          rangeId={rangeId}
          sampleReady={sampleReady}
          sampleTicks={sampleTicks}
          severeCount={severeCount}
          setRangeId={setRangeId}
        />
      ) : (
        <>
          <section className="metrics-grid">
        <Metric title="Kết nối" value={data.health?.status === "ok" ? "Ổn định" : "-"} detail={data.health?.database?.enabled ? "Đang lưu dữ liệu" : "Chế độ thử nghiệm"} />
        <Metric title="Thiết bị" value={`${onlineCount}/${data.devices.length}`} detail="đang trực tuyến" />
        <Metric title="Cảm biến" value={visibleReadings.length} detail={isSamplingActive ? "đang mô phỏng" : "đang tạm dừng"} />
        <Metric title="Chu kỳ mẫu" value={sampleReady ? "Sẵn sàng" : `${sampleTicks}/3`} detail={isSamplingActive ? "lần đo ổn định" : "chưa lấy mẫu"} />
        <Metric title="Bơm" value={runningPumps.length} detail="đang chạy" />
      </section>

      <section className="content-grid">
        <Panel title="Số Liệu Cảm Biến" wide>
          <div className="sensor-grid">
            {visibleReadings.map((reading) => (
              <article className="sensor-card" key={reading.sensorId}>
                <span>{sensorLabels[reading.type] || reading.type}</span>
                <strong>{reading.value}</strong>
                <small>{reading.unit} · {reading.sensorId}</small>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Thống Kê Chỉ Tiêu" wide>
          <div className="chart-toolbar">
            <div>
              <strong>{isSamplingActive ? "Bơm lấy mẫu đang đo" : "Mô phỏng đang tạm dừng"}</strong>
              <small>{sampleReady ? "Đã đủ chu kỳ đo để xét xả" : `Đã đo ${sampleTicks}/3 lần`} · Cập nhật gần nhất: {formatTime(lastSimulatedAt)}</small>
            </div>
            <div className="range-tabs" aria-label="Chọn khoảng thống kê">
              {rangeOptions.map((option) => (
                <button
                  key={option.id}
                  className={option.id === rangeId ? "active" : ""}
                  onClick={() => setRangeId(option.id)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="charts-grid">
            {sensorCatalog.map((sensor) => (
              <SensorChart
                key={sensor.id}
                sensor={sensor}
                series={simulation[sensor.id] || []}
                rangeId={rangeId}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Thiết Bị Và Bơm">
          <div className="stack">
            {data.devices.length ? data.devices.map((device) => (
              <article className="device-row" key={device.id}>
                <div className="row-head">
                  <div>
                    <strong>{device.name}</strong>
                    <small>{device.id} · {device.location}</small>
                  </div>
                  <span className={`status ${device.status}`}>{device.status === "online" ? "trực tuyến" : "mất kết nối"}</span>
                </div>
                {(device.pumps || []).map((pump) => (
                  <div className="pump-row" key={pump.id}>
                    <span>{pump.name}{isDrainPump(pump) ? " · tự động khi mẫu đạt" : ""}</span>
                    <span className={`status ${pump.status}`}>{pump.status === "running" ? "đang chạy" : "đang tắt"}</span>
                    <button disabled={isDrainPump(pump)} onClick={() => setPump(device.id, pump.id, "start")}>
                      {isDrainPump(pump) ? "Tự động" : "Bật"}
                    </button>
                    <button onClick={() => setPump(device.id, pump.id, "stop")}>Tắt</button>
                  </div>
                ))}
              </article>
            )) : (
              <div className="empty-with-action">
                <Empty text="Chưa tải được danh sách thiết bị" />
                <button className="primary-btn" onClick={loadStatus} disabled={loading}>
                  {loading ? "Đang tải..." : "Tải lại"}
                </button>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Tổng Kết Trong Ngày">
          <div className="report-grid">
            <Metric title="Ngày" value={data.report?.date || "-"} detail={data.report?.source === "influxdb" ? "dữ liệu lưu trữ" : "dữ liệu thử nghiệm"} compact />
            <Metric title="Nhật ký" value={data.report?.totals?.logs ?? "-"} detail="hôm nay" compact />
            <Metric title="Số liệu" value={data.report?.totals?.readings ?? "-"} detail="hôm nay" compact />
            <Metric title="Bơm chạy" value={data.report?.totals?.runningPumps ?? "-"} detail="hiện tại" compact />
          </div>
        </Panel>

        <Panel title="Nhật Ký Gần Đây" wide>
          <div className="table">
            {data.logs.map((log) => (
              <div className="table-row" key={log.id}>
                <span>{formatTime(log.createdAt)}</span>
                <strong>{log.type}</strong>
                <span>{log.deviceId}</span>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
        </>
      )}
      </section>
    </main>
  );
}

function SummaryPage({ acceptedCount, analysisRows, failedCount, isSamplingActive, passedCount, rangeId, sampleReady, sampleTicks, severeCount, setRangeId }) {
  const worstRows = [...analysisRows].sort((a, b) => b.deviation - a.deviation).slice(0, 4);
  const conclusion = severeCount
    ? `${severeCount} chỉ tiêu vượt ngoài khoảng chấp nhận, phải ngắt xả.`
    : failedCount
      ? `${acceptedCount} chỉ tiêu sai lệch nhẹ nhưng còn trong khoảng chấp nhận.`
      : "Tất cả chỉ tiêu đang nằm trong khoảng chuẩn.";
  const categoryData = [
    { id: "passed", label: "Đạt chuẩn", value: passedCount, className: "passed" },
    { id: "accepted", label: "Chấp nhận", value: acceptedCount, className: "accepted" },
    { id: "severe", label: "Vượt xa", value: severeCount, className: "severe" }
  ];

  return (
    <section className="summary-layout">
      <Panel title="Kết Luận Tổng Quát" wide>
        <div className="summary-head">
          <Metric title="Kết luận" value={severeCount ? "Ngắt xả" : failedCount ? "Chấp nhận" : "Đạt"} detail={conclusion} />
          <Metric title="Đạt chuẩn" value={passedCount} detail="chỉ tiêu" />
          <Metric title="Chấp nhận" value={acceptedCount} detail="sai lệch nhẹ" />
          <Metric title="Vượt xa" value={severeCount} detail="phải ngắt xả" />
          <Metric title="Chu kỳ mẫu" value={sampleReady ? "Đủ mẫu" : `${sampleTicks}/3`} detail={isSamplingActive ? "đợi đủ mẫu mới xét xả" : "bật bơm lấy mẫu để đo"} />
        </div>
        <div className="chart-toolbar summary-toolbar">
          <div>
            <strong>Khoảng thống kê</strong>
            <small>Dữ liệu phân tích theo lựa chọn ngày, tháng hoặc năm</small>
          </div>
          <div className="range-tabs" aria-label="Chọn khoảng thống kê tổng quát">
            {rangeOptions.map((option) => (
              <button
                key={option.id}
                className={option.id === rangeId ? "active" : ""}
                onClick={() => setRangeId(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Biểu Đồ Tổng Quát" wide>
        <div className="summary-charts">
          <PieSummaryChart data={categoryData} total={analysisRows.length} />
          <BarSummaryChart data={categoryData} total={analysisRows.length} />
          <BranchSummaryChart rows={analysisRows} />
        </div>
      </Panel>

      <Panel title="Mức Sai Lệch Cao Nhất" wide>
        <div className="deviation-grid">
          {worstRows.map((row) => (
            <article className="deviation-row" key={row.sensor.id}>
              <div>
                <strong>{sensorLabels[row.sensor.type] || row.sensor.type}</strong>
                <small>{row.passed ? "Nằm trong khoảng chuẩn" : `${row.direction} ${row.deviation} ${row.sensor.unit}`}</small>
              </div>
              <div className="deviation-track" aria-label={`Sai lệch ${row.deviationPercent}%`}>
                <span style={{ width: `${Math.min(100, row.deviationPercent)}%` }} />
              </div>
              <strong>{row.passed ? "0%" : `${row.deviationPercent}%`}</strong>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Bảng Phân Tích Chỉ Tiêu" wide>
        <div className="analysis-table">
          <div className="analysis-row table-head">
            <span>Chỉ tiêu</span>
            <span>Chuẩn</span>
            <span>Cho phép</span>
            <span>Trung bình</span>
            <span>Thấp nhất</span>
            <span>Cao nhất</span>
            <span>Kết luận</span>
            <span>Sai lệch</span>
          </div>
          {analysisRows.map((row) => (
            <div className="analysis-row" key={row.sensor.id}>
              <strong>{sensorLabels[row.sensor.type] || row.sensor.type}</strong>
              <span>{row.sensor.standardMin} - {row.sensor.standardMax} {row.sensor.unit}</span>
              <span>{row.sensor.acceptedMin} - {row.sensor.acceptedMax} {row.sensor.unit}</span>
              <span>{row.avg} {row.sensor.unit}</span>
              <span>{row.min} {row.sensor.unit}</span>
              <span>{row.max} {row.sensor.unit}</span>
              <span className={`status ${row.severe ? "danger" : row.passed ? "done" : "stopping"}`}>
                {row.severe ? "ngắt xả" : row.passed ? "đạt" : "chấp nhận"}
              </span>
              <span>{row.passed ? "0" : `${row.deviation} ${row.sensor.unit} (${row.deviationPercent}%)`}</span>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function PieSummaryChart({ data, total }) {
  let offset = 0;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  return (
    <article className="summary-chart-card">
      <div className="summary-chart-head">
        <strong>Biểu đồ tròn</strong>
        <small>Tỉ lệ kết luận</small>
      </div>
      <div className="pie-layout">
        <svg className="pie-chart" viewBox="0 0 120 120" role="img" aria-label="Tỉ lệ đạt chuẩn, chấp nhận và vượt xa">
          <circle className="pie-base" cx="60" cy="60" r={radius} />
          {data.map((item) => {
            const length = total ? (item.value / total) * circumference : 0;
            const segment = (
              <circle
                key={item.id}
                className={`pie-segment ${item.className}`}
                cx="60"
                cy="60"
                r={radius}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return segment;
          })}
          <text x="60" y="56" textAnchor="middle" className="pie-total">{total}</text>
          <text x="60" y="72" textAnchor="middle" className="pie-caption">chỉ tiêu</text>
        </svg>
        <div className="chart-legend">
          {data.map((item) => (
            <span key={item.id}><i className={item.className} />{item.label}: {item.value}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function BarSummaryChart({ data, total }) {
  return (
    <article className="summary-chart-card">
      <div className="summary-chart-head">
        <strong>Biểu đồ cột</strong>
        <small>Số lượng từng nhóm</small>
      </div>
      <div className="bar-chart" role="img" aria-label="Số lượng chỉ tiêu theo từng nhóm kết luận">
        {data.map((item) => (
          <div className="bar-item" key={item.id}>
            <div className="bar-track">
              <span className={item.className} style={{ height: `${total ? Math.max(8, (item.value / total) * 100) : 0}%` }} />
            </div>
            <strong>{item.value}</strong>
            <small>{item.label}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function BranchSummaryChart({ rows }) {
  const groups = [
    { id: "passed", label: "Đạt chuẩn", rows: rows.filter((row) => row.passed) },
    { id: "accepted", label: "Chấp nhận", rows: rows.filter((row) => !row.passed && row.accepted) },
    { id: "severe", label: "Vượt xa", rows: rows.filter((row) => row.severe) }
  ];

  return (
    <article className="summary-chart-card branch-card">
      <div className="summary-chart-head">
        <strong>Biểu đồ nhánh</strong>
        <small>Phân loại từng chỉ tiêu</small>
      </div>
      <div className="branch-chart" role="tree" aria-label="Nhánh phân loại chỉ tiêu đo">
        <div className="branch-root">10 chỉ tiêu</div>
        <div className="branch-groups">
          {groups.map((group) => (
            <div className="branch-group" key={group.id}>
              <strong className={group.id}>{group.label} · {group.rows.length}</strong>
              <div>
                {group.rows.length ? (
                  group.rows.map((row) => (
                    <span key={row.sensor.id}>{sensorLabels[row.sensor.type] || row.sensor.type}</span>
                  ))
                ) : (
                  <span>Không có</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function SchedulePage({ devices, pumpOptions, form, nowMs, schedules, onChangeForm, onAddSchedule, onRemoveSchedule }) {
  const selectedPumpExists = pumpOptions.some((pump) => pump.id === form.pumpId);

  useEffect(() => {
    if (!selectedPumpExists && pumpOptions[0]) {
      onChangeForm((current) => ({ ...current, pumpId: pumpOptions[0].id }));
    }
  }, [onChangeForm, pumpOptions, selectedPumpExists]);

  return (
    <section className="schedule-layout">
      <Panel title="Đặt Lịch Bơm">
        <form className="schedule-form" onSubmit={onAddSchedule}>
          <label>
            Trạm
            <select
              value={form.deviceId}
              onChange={(event) => onChangeForm((current) => ({ ...current, deviceId: event.target.value }))}
            >
              {devices.map((device) => (
                <option key={device.id} value={device.id}>{device.name}</option>
              ))}
            </select>
          </label>

          <label>
            Bơm
            <select
              value={form.pumpId}
              onChange={(event) => onChangeForm((current) => ({ ...current, pumpId: event.target.value }))}
            >
              {pumpOptions.map((pump) => (
                <option key={pump.id} value={pump.id}>{pump.name}</option>
              ))}
            </select>
          </label>

          <label className="datetime-field">
            Giờ bơm nước
            <input
              type="datetime-local"
              value={form.startAt}
              onChange={(event) => onChangeForm((current) => ({ ...current, startAt: event.target.value }))}
            />
          </label>

          <label className="datetime-field">
            Giờ ngừng nước
            <input
              type="datetime-local"
              value={form.stopAt}
              onChange={(event) => onChangeForm((current) => ({ ...current, stopAt: event.target.value }))}
            />
          </label>

          <label className="form-wide">
            Ghi chú
            <input
              value={form.note}
              onChange={(event) => onChangeForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="Ví dụ: bơm lấy mẫu đầu ca"
            />
          </label>

          <button className="primary-btn form-wide" type="submit">Thêm lịch</button>
        </form>
      </Panel>

      <Panel title="Theo Dõi Thời Gian Thực">
        <div className="clock-card">
          <span>Thời gian hiện tại</span>
          <strong>{formatTime(new Date(nowMs).toISOString())}</strong>
        </div>
        <div className="schedule-list">
          {schedules.length ? (
            schedules.map((schedule) => {
              const state = getScheduleState(schedule, nowMs);
              return (
                <article className="schedule-row" key={schedule.id}>
                  <div>
                    <strong>{schedule.note || schedule.pumpId}</strong>
                    <small>{schedule.deviceId} · {schedule.pumpId}</small>
                  </div>
                  <div>
                    <span>Bơm: {formatTime(schedule.startAt)}</span>
                    <span>Ngừng: {formatTime(schedule.stopAt)}</span>
                  </div>
                  <div>
                    <span className={`status ${state.className}`}>{state.label}</span>
                    <small>{state.detail}</small>
                  </div>
                  <button type="button" onClick={() => onRemoveSchedule(schedule.id)}>Xóa</button>
                </article>
              );
            })
          ) : (
            <Empty text="Chưa có lịch bơm" />
          )}
        </div>
      </Panel>
    </section>
  );
}

function SensorChart({ sensor, series, rangeId }) {
  const width = 320;
  const height = 150;
  const padding = { top: 16, right: 16, bottom: 28, left: 38 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = series.map((point) => point.value);
  const minValue = Math.min(sensor.min, ...values);
  const maxValue = Math.max(sensor.max, ...values);
  const range = maxValue - minValue || 1;
  const points = series.map((point, index) => {
    const x = padding.left + (index / Math.max(1, series.length - 1)) * plotWidth;
    const y = padding.top + (1 - (point.value - minValue) / range) * plotHeight;
    return { ...point, x, y };
  });
  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const latest = points.at(-1);
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const rangeText = rangeId === "day" ? "trong ngày" : rangeId === "month" ? "trong tháng" : "trong năm";

  return (
    <article className="chart-card">
      <div className="chart-head">
        <div>
          <strong>{sensorLabels[sensor.type] || sensor.type}</strong>
          <small>{sensor.id}</small>
        </div>
        <div className="chart-value">
          <strong>{latest?.value ?? "-"}</strong>
          <small>{sensor.unit}</small>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${sensorLabels[sensor.type] || sensor.type} ${rangeText}`}>
        <line className="chart-grid-line" x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} />
        <line className="chart-grid-line" x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} />
        <line
          className="chart-average"
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + (1 - (average - minValue) / range) * plotHeight}
          y2={padding.top + (1 - (average - minValue) / range) * plotHeight}
        />
        <polyline className="chart-line" points={line} />
        {latest && <circle className="chart-dot" cx={latest.x} cy={latest.y} r="4" />}
        <text className="chart-axis" x={padding.left} y={height - 8}>đầu kỳ</text>
        <text className="chart-axis end" x={width - padding.right} y={height - 8}>hiện tại</text>
        <text className="chart-axis" x={4} y={padding.top + 4}>{maxValue.toFixed(0)}</text>
        <text className="chart-axis" x={4} y={height - padding.bottom}>{minValue.toFixed(0)}</text>
      </svg>
    </article>
  );
}

function Metric({ title, value, detail, compact = false }) {
  return (
    <article className={`metric ${compact ? "compact" : ""}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Panel({ title, children, wide = false }) {
  return (
    <section className={`panel ${wide ? "wide" : ""}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

createRoot(document.getElementById("root")).render(<App />);
