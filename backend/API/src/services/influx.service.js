import { InfluxDB, Point } from "@influxdata/influxdb-client";

const config = {
  url: process.env.INFLUXDB_URL || "http://localhost:8086",
  token: process.env.INFLUXDB_TOKEN || "",
  org: process.env.INFLUXDB_ORG || "lata",
  bucket: process.env.INFLUXDB_BUCKET || "wastewater",
  measurement: process.env.INFLUXDB_MEASUREMENT || "sensor_reading"
};

const influx = config.token ? new InfluxDB({ url: config.url, token: config.token }) : null;

export const isInfluxEnabled = () => Boolean(influx);

const escapeFluxString = (value) => String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const fluxString = (value) => `"${escapeFluxString(value)}"`;

const fluxTime = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `time(v: ${fluxString(date.toISOString())})`;
};

const buildRange = ({ start, end, defaultStart = "-24h" } = {}) => {
  const startValue = fluxTime(start) || defaultStart;
  const endValue = fluxTime(end);
  return endValue ? `range(start: ${startValue}, stop: ${endValue})` : `range(start: ${startValue})`;
};

const toReading = (row) => ({
  sensorId: row.sensorId,
  deviceId: row.deviceId,
  type: row.type,
  value: Number(row._value),
  unit: row.unit,
  timestamp: row._time
});

const queryRows = async (flux) => {
  if (!influx) throw Object.assign(new Error("InfluxDB is not configured."), { status: 503 });
  return influx.getQueryApi(config.org).collectRows(flux);
};

export const writeTelemetryReadings = async (readings) => {
  if (!influx) return { enabled: false, count: 0 };

  const writeApi = influx.getWriteApi(config.org, config.bucket, "ms");

  for (const reading of readings) {
    const point = new Point(config.measurement)
      .tag("deviceId", reading.deviceId)
      .tag("sensorId", reading.sensorId)
      .tag("type", reading.type)
      .tag("unit", reading.unit)
      .floatField("value", reading.value)
      .timestamp(new Date(reading.timestamp));

    writeApi.writePoint(point);
  }

  await writeApi.close();
  return { enabled: true, count: readings.length };
};

export const queryLatestReadings = async ({ deviceId, type } = {}) => {
  const filters = [
    `r._measurement == ${fluxString(config.measurement)}`,
    `r._field == "value"`
  ];
  if (deviceId) filters.push(`r.deviceId == ${fluxString(deviceId)}`);
  if (type) filters.push(`r.type == ${fluxString(type)}`);

  const rows = await queryRows(`
from(bucket: ${fluxString(config.bucket)})
  |> range(start: -30d)
  |> filter(fn: (r) => ${filters.join(" and ")})
  |> group(columns: ["deviceId", "sensorId", "type", "unit"])
  |> last()
`);

  return rows.map(toReading).sort((a, b) => a.sensorId.localeCompare(b.sensorId));
};

export const querySensorHistory = async ({ sensorId, start, end }) => {
  const rows = await queryRows(`
from(bucket: ${fluxString(config.bucket)})
  |> ${buildRange({ start, end })}
  |> filter(fn: (r) => r._measurement == ${fluxString(config.measurement)} and r._field == "value" and r.sensorId == ${fluxString(sensorId)})
  |> sort(columns: ["_time"])
`);

  return rows.map(toReading);
};

export const queryReadingsRange = async ({ start, end }) => {
  const rows = await queryRows(`
from(bucket: ${fluxString(config.bucket)})
  |> ${buildRange({ start, end })}
  |> filter(fn: (r) => r._measurement == ${fluxString(config.measurement)} and r._field == "value")
  |> sort(columns: ["_time"])
`);

  return rows.map(toReading);
};

export const deleteTelemetryReadings = async () => {
  if (!influx) return { enabled: false, deleted: false };

  const response = await fetch(
    `${config.url}/api/v2/delete?org=${encodeURIComponent(config.org)}&bucket=${encodeURIComponent(config.bucket)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        start: "1970-01-01T00:00:00Z",
        stop: "2100-01-01T00:00:00Z",
        predicate: `_measurement="${escapeFluxString(config.measurement)}"`
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`InfluxDB delete failed: ${body || response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return {
    enabled: true,
    deleted: true,
    bucket: config.bucket,
    measurement: config.measurement
  };
};

export const getInfluxConfig = () => ({
  enabled: isInfluxEnabled(),
  url: config.url,
  org: config.org,
  bucket: config.bucket,
  measurement: config.measurement
});
