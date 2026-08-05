# LATA Backend API

Backend Express cho quản lý thiết bị quan trắc nước thải, telemetry cảm biến, bơm, cảnh báo, log và báo cáo ngày.

Telemetry dùng **InfluxDB**:

- Bucket: `wastewater`
- Measurement: `sensor_reading`
- Tags: `deviceId`, `sensorId`, `type`, `unit`
- Field: `value`
- Timestamp: theo payload `timestamp` hoặc thời gian server nhận dữ liệu

## Bộ chỉ tiêu đo

| Chỉ tiêu | Loại cảm biến/đầu dò | Type trong API | Đơn vị |
|---|---|---|---|
| Lưu lượng đầu vào | Cảm biến siêu âm | `flow_in` | `m3/h` |
| Lưu lượng đầu ra | Cảm biến siêu âm | `flow_out` | `m3/h` |
| pH | Cảm biến điện cực pH | `ph` | `pH` |
| Nhiệt độ | PT100 tích hợp | `temperature` | `C` |
| Nhiệt độ test | DHT22 | `dht22_temperature` | `C` |
| Độ ẩm test | DHT22 | `dht22_humidity` | `%` |
| Tín hiệu analog test | MQ2 | `mq2_raw` | `ADC` |
| Nồng độ khí ước tính | MQ2 đã hiệu chuẩn | `mq2_gas` | `ppm` |
| COD | Đầu dò quang phổ UV-VIS | `cod` | `mg/L` |
| BOD | Ước tính/tính toán từ đầu dò quang học | `bod` | `mg/L` |
| TOC | Ước tính/tính toán từ đầu dò quang học | `toc` | `mg/L` |
| DO | Đầu dò oxy hòa tan | `dissolved_oxygen` | `mg/L` |
| EC | Đầu dò độ dẫn điện | `electrical_conductivity` | `mS/cm` |
| Color | Đo màu quang học | `color` | `Pt-Co` |
| NH4/Amoni | Điện cực chọn lọc ion | `ammonium` | `mg/L` |
| TSS/Độ đục | Cảm biến tán xạ ánh sáng hồng ngoại | `tss` | `mg/L` |

## Cấu trúc API

```text
src/
  server.js                  # Start server
  app.js                     # Middleware + mount routes
  store.js                   # Data demo trong bo nho
  routes/
    health.routes.js         # GET /api/health
    devices.routes.js        # GET /api/devices, GET /api/devices/:id
    sensors.routes.js        # GET /api/sensors/latest, history, POST telemetry
    pumps.routes.js          # Pump start/stop/status
    alerts.routes.js         # GET /api/alerts
    logs.routes.js           # GET /api/logs
    reports.routes.js        # GET /api/reports/daily
  services/
    devices.service.js       # Logic tim device/pump
    sensors.service.js       # Logic telemetry/latest/alert threshold
    influx.service.js        # Ghi/doc telemetry tu InfluxDB
    mqtt.service.js          # Subscribe MQTT va luu telemetry
  utils/
    date.js                  # Parse date/range
    http.js                  # Response helper
```

## Chạy server

```bash
npm install
npm start
```

Mặc định API chạy ở:

```text
http://localhost:3000
```

Có thể đổi cổng:

```bash
PORT=4000 npm start
```

## Cấu hình InfluxDB

Khi có `INFLUXDB_TOKEN`, API sẽ ghi và đọc telemetry từ InfluxDB. Nếu chưa cấu hình token, API tự fallback sang dữ liệu demo trong bộ nhớ để tiện chạy local.

```env
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=change_me_influxdb_token
INFLUXDB_ORG=lata
INFLUXDB_BUCKET=wastewater
INFLUXDB_MEASUREMENT=sensor_reading
```

## Bảo mật API

Các endpoint ghi dữ liệu và điều khiển thiết bị yêu cầu API key khi cấu hình `API_KEY`:

- `POST /api/sensors/data`
- `POST /api/devices/:deviceId/pumps/:pumpId/start`
- `POST /api/devices/:deviceId/pumps/:pumpId/stop`

Trong production, nếu thiếu `API_KEY`, API sẽ trả lỗi cấu hình cho các endpoint nhạy cảm. Local/dev vẫn có thể chạy không cần key để tiện kiểm thử.

```env
API_KEY=change_me_api_key_min_32_chars
CORS_ORIGINS=http://localhost:5173,https://your-domain.example
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
TRUST_PROXY=true
```

Gửi key bằng một trong hai cách:

```http
X-API-Key: your_api_key
Authorization: Bearer your_api_key
```

## Response format

Thành công:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Lỗi:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## API endpoints

### Health

```http
GET /api/health
```

Kiểm tra server còn sống.

### Devices

```http
GET /api/devices
GET /api/devices/:id
```

Query hỗ trợ:

- `GET /api/devices?status=online`

### Sensors

```http
GET /api/sensors/latest
GET /api/sensors/:sensorId/history?start=2026-07-06T00:00:00Z&end=2026-07-06T23:59:59Z
POST /api/sensors/data
```

Lấy sensor mới nhất:

```bash
curl "http://localhost:3000/api/sensors/latest"
```

Gửi một telemetry:

```bash
curl -X POST "http://localhost:3000/api/sensors/data" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "sensorId": "cod-001",
    "value": 128,
    "timestamp": "2026-07-06T10:00:00.000Z"
  }'
```

Gửi nhiều telemetry:

```bash
curl -X POST "http://localhost:3000/api/sensors/data" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "deviceId": "lata-001",
    "readings": [
      { "sensorId": "ph-001", "value": 7.3 },
      { "sensorId": "temp-001", "value": 30.5 },
      { "sensorId": "cod-001", "value": 128 },
      { "sensorId": "nh4-001", "value": 6.2 },
      { "sensorId": "tss-001", "value": 92 }
    ]
  }'
```

Payload dạng firmware cũng được hỗ trợ:

```bash
curl -X POST "http://localhost:3000/api/sensors/data" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "deviceId": "lata-001",
    "flow_in_m3h": 18.4,
    "flow_out_m3h": 17.9,
    "ph": 7.3,
    "temperature_c": 30.5,
    "cod_mgl": 128,
    "bod_mgl": 42,
    "toc_mgl": 31,
    "do_mgl": 3.2,
    "ec_mscm": 2.3,
    "color_ptco": 85,
    "nh4_mgl": 6.2,
    "tss_mgl": 92
  }'
```

Payload firmware cũng nhận alias như `nh4`, `amoni`, `ammonium`, `tss`, `turbidity`, `do`, `ec`, `flow_in`, `flow_out`.

Payload test DHT22 và MQ2:

```json
{
  "dht22_temperature_c": 29.4,
  "dht22_humidity_percent": 71.2,
  "mq2_raw": 1380,
  "mq2_ppm": 245
}
```

API subscribe topic `lata/+/data`. `deviceId` được lấy từ topic nên payload MQTT có thể bỏ field này. Các biến môi trường hỗ trợ: `MQTT_BROKER`, `MQTT_PORT`, `MQTT_PROTOCOL`, `MQTT_USERNAME`, `MQTT_PASSWORD` và `MQTT_TOPIC_FILTER`.

API tự sinh alert theo ngưỡng tham khảo trong metadata: pH ngoài `5.5-9`, nhiệt độ trên `40C`, COD/BOD/TOC/TSS/NH4/EC/color vượt ngưỡng tham khảo, DO dưới `2mg/L`.

### Pumps / Actuators

```http
POST /api/devices/:deviceId/pumps/:pumpId/start
POST /api/devices/:deviceId/pumps/:pumpId/stop
GET /api/devices/:deviceId/pumps/status
```

Ví dụ:

```bash
curl -X POST "http://localhost:3000/api/devices/lata-001/pumps/pump-01/start" \
  -H "X-API-Key: your_api_key"
curl "http://localhost:3000/api/devices/lata-001/pumps/status"
curl -X POST "http://localhost:3000/api/devices/lata-001/pumps/pump-01/stop" \
  -H "X-API-Key: your_api_key"
```

### Alerts & Logs

```http
GET /api/alerts?status=active
GET /api/logs?deviceId=lata-001&limit=100
```

Query hỗ trợ cho alerts:

- `status=active`
- `deviceId=lata-001`
- `severity=warning`

### Reports

```http
GET /api/reports/daily?date=2026-07-06
```

Trả tổng số thiết bị, readings trong ngày, active alerts, logs, bơm đang chạy, thống kê min/max/avg theo sensor và trạng thái pump.

## Ghi chú

Telemetry production dùng InfluxDB. Phần `src/store.js` hiện chỉ giữ metadata demo của devices/pumps/sensors và cache alert/log trong RAM; nếu cần bền vững cho metadata thì thêm PostgreSQL/MySQL sau.
