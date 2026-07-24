# Backend – Cloud Stack (Docker)

**Phụ trách:** Nguyễn Khắc Huy (chính) · Review: Hoàng Minh Phụng

## Stack

| Service | Image | Port | Vai trò |
|---|---|---|---|
| Mosquitto | `eclipse-mosquitto:2` | 1883 / 8883 (TLS) | MQTT Broker nhận dữ liệu từ thiết bị |
| Node-RED | `nodered/node-red` | 1880 | Flow: MQTT → InfluxDB, rule engine, alert |
| InfluxDB 2.x | `influxdb:2.7` | 8086 | Time-series database |
| Grafana | `grafana/grafana` | 3000 | Dashboard nhanh (dev/debug) |
| Express API | Node.js | 8000 | REST API cho webapp, ghi/doc telemetry tu InfluxDB |
| Nginx | `nginx:alpine` | 80 / 443 | Reverse proxy, SSL, serve webapp |

## Khởi động

```bash
cd backend/

# Sao chép file cấu hình môi trường
cp .env.example .env
# Chỉnh sửa .env: điền token InfluxDB, API_KEY, domain/origin frontend, ...

# Khởi động toàn bộ stack
docker compose up -d

# Xem log
docker compose logs -f

# Dừng
docker compose down
```

## Cấu trúc

```
backend/
├── docker-compose.yml
├── .env.example               # Template biến môi trường (KHÔNG commit .env thật)
├── mosquitto/
│   └── config/
│       └── mosquitto.conf     # Cấu hình broker: port, TLS, auth
├── API/
│   ├── src/
│   │   ├── app.js             # Express app: middleware + mount routes
│   │   ├── server.js          # Start server
│   │   ├── routes/            # Route handlers
│   │   └── services/
│   │       └── influx.service.js
│   ├── package.json
│   └── Dockerfile
├── nodered/                   # Export flows.json vào đây
├── influxdb/                  # Init scripts
└── nginx/
    └── nginx.conf
```

## MQTT → InfluxDB flow (Node-RED)

```
[MQTT in: lata/+/data]
      │
[JSON parse]
      │
[Validate + transform]  ←── kiểm tra giá trị hợp lệ, thêm tags
      │
[InfluxDB out: bucket=wastewater]
      │
[Alert check]  ──── nếu vượt ngưỡng QCVN → gửi email/webhook
```

## API Endpoints (Express)

```
GET    /api/health
GET    /api/devices
GET    /api/devices/:id
GET    /api/sensors/latest
GET    /api/sensors/:sensorId/history?start=...&end=...
POST   /api/sensors/data
POST   /api/devices/:deviceId/pumps/:pumpId/start
POST   /api/devices/:deviceId/pumps/:pumpId/stop
GET    /api/devices/:deviceId/pumps/status
GET    /api/alerts?status=active
GET    /api/logs?deviceId=...&limit=100
GET    /api/reports/daily?date=2026-07-06
```

## Bảo mật

- Đặt `API_KEY` mạnh trong `backend/.env` trước khi chạy production.
- Frontend/firmware gọi endpoint ghi hoặc điều khiển bằng header `X-API-Key: <API_KEY>` hoặc `Authorization: Bearer <API_KEY>`.
- Chỉ khai báo domain frontend hợp lệ trong `CORS_ORIGINS`, phân tách bằng dấu phẩy.
- API có rate limit mặc định `120` request mỗi `60` giây theo IP/API key; chỉnh bằng `RATE_LIMIT_MAX` và `RATE_LIMIT_WINDOW_MS`.
