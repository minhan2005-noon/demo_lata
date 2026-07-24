# Database review

Ket luan: du an nen dung InfluxDB cho telemetry cam bien realtime.

## Huong dung hien tai

- `backend/docker-compose.yml` da co service `influxdb:2.7`.
- API doc va compose dung:
  - `INFLUXDB_ORG=lata`
  - `INFLUXDB_BUCKET=wastewater`
  - `INFLUXDB_MEASUREMENT=sensor_reading`
- Measurement `sensor_reading`:
  - tags: `deviceId`, `sensorId`, `type`, `unit`
  - field: `value`
  - timestamp: thoi diem ghi nhan du lieu

## API da noi InfluxDB

- `POST /api/sensors/data`: ghi telemetry vao InfluxDB khi co `INFLUXDB_TOKEN`.
- `GET /api/sensors/latest`: doc latest readings tu InfluxDB.
- `GET /api/sensors/:sensorId/history`: doc history tu InfluxDB.
- `GET /api/reports/daily`: tinh thong ke ngay tu InfluxDB.

Neu chua cau hinh `INFLUXDB_TOKEN`, API fallback sang data demo trong memory de chay local.

## File SQL hien co

`backend/mosquitto/database_schema.sql` la schema MySQL/MariaDB. File nay khong khop voi stack hien tai vi Docker Compose khong co MySQL/MariaDB service.

Co the giu file SQL lam tham khao cho metadata nhu users/devices/pumps/alerts/logs, nhung khong nen dung MySQL cho bang `sensor_data` realtime. Du lieu sensor theo thoi gian nen o InfluxDB.

## Viec can lam sau neu can production day du

- Them database metadata ben vung cho users/devices/pumps/alerts/logs, vi hien tai metadata trong API van la memory demo.
- Dinh nghia retention policy/bucket retention cho InfluxDB theo yeu cau luu tru.
- Them Node-RED flow MQTT -> InfluxDB hoac de API nhan telemetry truc tiep qua `POST /api/sensors/data`.
