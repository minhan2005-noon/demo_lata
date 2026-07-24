const now = new Date();

const minutesAgo = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString();

const sensorDefinitions = [
  {
    prefix: "flow-in",
    name: "Inlet ultrasonic flow",
    type: "flow_in",
    unit: "m3/h",
    method: "Ultrasonic flow sensor - inlet",
    min: 0,
    max: 10000
  },
  {
    prefix: "flow-out",
    name: "Outlet ultrasonic flow",
    type: "flow_out",
    unit: "m3/h",
    method: "Ultrasonic flow sensor - outlet",
    min: 0,
    max: 10000
  },
  {
    prefix: "ph",
    name: "pH",
    type: "ph",
    unit: "pH",
    method: "pH electrode sensor",
    min: 0,
    max: 14,
    warningMin: 5.5,
    warningMax: 9,
    criticalMin: 4.5,
    criticalMax: 10
  },
  {
    prefix: "temp",
    name: "Temperature",
    type: "temperature",
    unit: "C",
    method: "Integrated PT100 sensor",
    min: -10,
    max: 100,
    warningMax: 40,
    criticalMax: 50
  },
  {
    prefix: "cod",
    name: "COD",
    type: "cod",
    unit: "mg/L",
    method: "UV-VIS spectral probe",
    min: 0,
    max: 5000,
    warningMax: 150,
    criticalMax: 300
  },
  {
    prefix: "bod",
    name: "BOD",
    type: "bod",
    unit: "mg/L",
    method: "Estimated/calculated from optical probe model",
    min: 0,
    max: 2000,
    warningMax: 50,
    criticalMax: 100
  },
  {
    prefix: "toc",
    name: "TOC",
    type: "toc",
    unit: "mg/L",
    method: "Estimated/calculated from optical probe model",
    min: 0,
    max: 2000,
    warningMax: 50,
    criticalMax: 100
  },
  {
    prefix: "do",
    name: "DO",
    type: "dissolved_oxygen",
    unit: "mg/L",
    method: "Dissolved oxygen probe",
    min: 0,
    max: 20,
    warningMin: 2,
    criticalMin: 1
  },
  {
    prefix: "ec",
    name: "EC",
    type: "electrical_conductivity",
    unit: "mS/cm",
    method: "Electrical conductivity probe",
    min: 0,
    max: 100,
    warningMax: 5,
    criticalMax: 10
  },
  {
    prefix: "color",
    name: "Color",
    type: "color",
    unit: "Pt-Co",
    method: "Optical color measurement",
    min: 0,
    max: 10000,
    warningMax: 150,
    criticalMax: 300
  },
  {
    prefix: "nh4",
    name: "NH4 / Amoni",
    type: "ammonium",
    unit: "mg/L",
    method: "Ion-selective electrode",
    min: 0,
    max: 1000,
    warningMax: 10,
    criticalMax: 20
  },
  {
    prefix: "tss",
    name: "TSS / Turbidity",
    type: "tss",
    unit: "mg/L",
    method: "Infrared light scattering sensor",
    min: 0,
    max: 10000,
    warningMax: 100,
    criticalMax: 200
  }
];

const stationSuffix = (stationNumber) => String(stationNumber).padStart(3, "0");

const sensorIdsForStation = (stationNumber) =>
  sensorDefinitions.map((sensor) => `${sensor.prefix}-${stationSuffix(stationNumber)}`);

const sensorMetaForStation = (deviceId, stationNumber) =>
  Object.fromEntries(
    sensorDefinitions.map((sensor) => {
      const id = `${sensor.prefix}-${stationSuffix(stationNumber)}`;
      return [
        id,
        {
          id,
          deviceId,
          name: sensor.name,
          type: sensor.type,
          unit: sensor.unit,
          method: sensor.method,
          min: sensor.min,
          max: sensor.max,
          warningMin: sensor.warningMin,
          warningMax: sensor.warningMax,
          criticalMin: sensor.criticalMin,
          criticalMax: sensor.criticalMax
        }
      ];
    })
  );

export const devices = [
  {
    id: "lata-001",
    name: "LATA Wastewater Station 01",
    location: "Tram quan trac nuoc thai 01",
    status: "online",
    firmwareVersion: "0.1.0",
    lastSeenAt: minutesAgo(1),
    pumps: [
      { id: "pump-01", name: "Sampling pump", status: "stopped", flowRateLpm: 12 },
      { id: "pump-02", name: "Drain pump", status: "stopped", flowRateLpm: 20 }
    ],
    sensors: sensorIdsForStation(1)
  },
  {
    id: "lata-002",
    name: "LATA Wastewater Station 02",
    location: "Tram quan trac nuoc thai 02",
    status: "offline",
    firmwareVersion: "0.1.0",
    lastSeenAt: minutesAgo(45),
    pumps: [{ id: "pump-01", name: "Sampling pump", status: "stopped", flowRateLpm: 12 }],
    sensors: sensorIdsForStation(2)
  }
];

export const sensorMeta = {
  ...sensorMetaForStation("lata-001", 1),
  ...sensorMetaForStation("lata-002", 2)
};

export const sensorReadings = [
  { sensorId: "flow-in-001", deviceId: "lata-001", type: "flow_in", value: 18.4, unit: "m3/h", timestamp: minutesAgo(2) },
  { sensorId: "flow-out-001", deviceId: "lata-001", type: "flow_out", value: 17.9, unit: "m3/h", timestamp: minutesAgo(2) },
  { sensorId: "ph-001", deviceId: "lata-001", type: "ph", value: 7.3, unit: "pH", timestamp: minutesAgo(2) },
  { sensorId: "temp-001", deviceId: "lata-001", type: "temperature", value: 30.5, unit: "C", timestamp: minutesAgo(2) },
  { sensorId: "cod-001", deviceId: "lata-001", type: "cod", value: 128, unit: "mg/L", timestamp: minutesAgo(2) },
  { sensorId: "bod-001", deviceId: "lata-001", type: "bod", value: 42, unit: "mg/L", timestamp: minutesAgo(2) },
  { sensorId: "toc-001", deviceId: "lata-001", type: "toc", value: 31, unit: "mg/L", timestamp: minutesAgo(2) },
  { sensorId: "do-001", deviceId: "lata-001", type: "dissolved_oxygen", value: 3.6, unit: "mg/L", timestamp: minutesAgo(2) },
  { sensorId: "ec-001", deviceId: "lata-001", type: "electrical_conductivity", value: 2.4, unit: "mS/cm", timestamp: minutesAgo(2) },
  { sensorId: "color-001", deviceId: "lata-001", type: "color", value: 85, unit: "Pt-Co", timestamp: minutesAgo(2) },
  { sensorId: "nh4-001", deviceId: "lata-001", type: "ammonium", value: 6.2, unit: "mg/L", timestamp: minutesAgo(2) },
  { sensorId: "tss-001", deviceId: "lata-001", type: "tss", value: 92, unit: "mg/L", timestamp: minutesAgo(2) }
];

export const alerts = [
  {
    id: "alert-001",
    deviceId: "lata-001",
    sensorId: "tss-001",
    type: "TSS_CLOSE_TO_LIMIT",
    severity: "warning",
    status: "active",
    message: "TSS is close to warning threshold.",
    createdAt: minutesAgo(2),
    resolvedAt: null
  }
];

export const logs = [
  {
    id: "log-001",
    deviceId: "lata-002",
    type: "DEVICE_OFFLINE",
    message: "Device lata-002 has not reported recently.",
    createdAt: minutesAgo(15)
  },
  {
    id: "log-002",
    deviceId: "lata-001",
    type: "TELEMETRY_RECEIVED",
    message: "Telemetry batch received from lata-001.",
    createdAt: minutesAgo(2)
  }
];

let idCounter = 100;

export function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${String(idCounter).padStart(3, "0")}`;
}

export function addLog({ deviceId, type, message }) {
  const log = {
    id: nextId("log"),
    deviceId,
    type,
    message,
    createdAt: new Date().toISOString()
  };
  logs.unshift(log);
  return log;
}

export function addAlert({ deviceId, sensorId, type, severity, message }) {
  const alert = {
    id: nextId("alert"),
    deviceId,
    sensorId,
    type,
    severity,
    status: "active",
    message,
    createdAt: new Date().toISOString(),
    resolvedAt: null
  };
  alerts.unshift(alert);
  return alert;
}
