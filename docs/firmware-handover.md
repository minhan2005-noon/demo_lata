# Tai lieu ban giao Firmware - LATA

## Muc dich

Tai lieu nay dung de ban giao cho team firmware phan ket noi thiet bi ESP32 len he thong LATA. Firmware se doc du lieu cam bien qua RS485/Modbus, sau do gui telemetry len server qua MQTT.

## Endpoint ban giao cho firmware

Firmware hien tai duoc thiet ke gui du lieu qua MQTT, khong goi REST API truc tiep.

```txt
MQTT Broker Host: <domain-hoac-IP-server>
MQTT Port:
- Dev/internal: 1883
- Production/TLS: 8883

Protocol: MQTT
QoS: 1
Payload: JSON
```

### Topic publish

Firmware publish du lieu cam bien len topic:

```txt
lata/{device_id}/data
```

Vi du voi thiet bi `lata-001`:

```txt
lata/lata-001/data
```

### Topic subscribe

Firmware can subscribe cac topic sau:

```txt
lata/{device_id}/config
lata/{device_id}/ota
```

Y nghia:

| Topic | Chieu | Muc dich |
|---|---:|---|
| `lata/{device_id}/data` | Firmware -> Server | Gui du lieu cam bien |
| `lata/{device_id}/config` | Server -> Firmware | Nhan cau hinh tu server |
| `lata/{device_id}/ota` | Server -> Firmware | Nhan lenh OTA update |

## Payload telemetry

Firmware gui JSON len topic `lata/{device_id}/data`.

```json
{
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
  "tss_mgl": 92,
  "timestamp": "2026-07-29T10:00:00Z"
}
```

### Truong bat buoc

| Truong | Kieu | Ghi chu |
|---|---|---|
| `deviceId` | string | Ma thiet bi, vi du `lata-001` |
| `timestamp` | string | ISO 8601 UTC. Neu firmware chua co RTC/NTP thi co the tam thoi bo qua de server tu gan thoi gian nhan |

### Truong du lieu cam bien

| Truong firmware | Chi tieu | Don vi |
|---|---|---|
| `flow_in_m3h` | Luu luong dau vao | m3/h |
| `flow_out_m3h` | Luu luong dau ra | m3/h |
| `ph` | pH | pH |
| `temperature_c` | Nhiet do | C |
| `cod_mgl` | COD | mg/L |
| `bod_mgl` | BOD | mg/L |
| `toc_mgl` | TOC | mg/L |
| `do_mgl` | DO | mg/L |
| `ec_mscm` | Do dan dien EC | mS/cm |
| `color_ptco` | Mau | Pt-Co |
| `nh4_mgl` | NH4/Amoni | mg/L |
| `tss_mgl` | TSS/Do duc | mg/L |

Firmware chi gui cac truong co du lieu hop le. Gia tri cam bien phai la number, khong gui string cho cac truong so.

## Cau hinh firmware can nhan

Firmware can ho tro AP provisioning lan dau de user nhap:

| Cau hinh | Vi du | Ghi chu |
|---|---|---|
| WiFi SSID | `LATA-WIFI` | Ten WiFi |
| WiFi Password | `********` | Mat khau WiFi |
| MQTT Broker Host | `mqtt.example.com` | Domain hoac IP server |
| Device ID | `lata-001` | Ma thiet bi |
| Sample interval | `300000` | Chu ky doc/gui du lieu, don vi ms |

AP provisioning hien tai du kien dung SSID dang:

```txt
LATA-Setup-xxxxxx
```

Trang cau hinh:

```txt
http://192.168.4.1
```

## Task giao cho team firmware

1. Hoan thien doc du lieu cam bien qua RS485/Modbus.
2. Mapping du lieu doc duoc vao payload telemetry dung field o tren.
3. Hoan thien AP provisioning de luu WiFi SSID, WiFi password, MQTT broker host, `deviceId`, sample interval.
4. Ket noi WiFi. Neu WiFi fail thi chuan bi fallback 4G/SIM7600 neu phan cung yeu cau.
5. Ket noi MQTT broker.
6. Publish telemetry len `lata/{device_id}/data` voi QoS 1 theo chu ky cau hinh.
7. Subscribe `lata/{device_id}/config` de nhan cau hinh tu server.
8. Subscribe `lata/{device_id}/ota` de nhan lenh OTA update.
9. Luu log offline vao SD card khi mat mang.
10. Khi co mang lai, gui bu du lieu offline neu kich ban du an yeu cau.
11. Hien thi trang thai co ban tren OLED: WiFi, MQTT, deviceId, lan gui cuoi, loi sensor neu co.

## De xuat payload config

Server co the publish cau hinh xuong topic `lata/{device_id}/config`.

```json
{
  "sampleIntervalMs": 300000,
  "mqttHost": "mqtt.example.com",
  "mqttPort": 8883,
  "enableOfflineBuffer": true
}
```

Firmware can validate payload truoc khi apply. Neu cau hinh hop le thi luu vao NVS va reboot neu can.

## De xuat payload OTA

Server co the publish lenh OTA xuong topic `lata/{device_id}/ota`.

```json
{
  "version": "0.1.1",
  "url": "https://example.com/firmware/lata-0.1.1.bin",
  "sha256": "<firmware-sha256>"
}
```

Firmware can:

1. Kiem tra version moi hon version hien tai.
2. Tai file firmware tu `url`.
3. Kiem tra `sha256`.
4. Update OTA.
5. Reboot va report trang thai sau khi update.

## REST API tham chieu cho backend

Neu can test nhanh khong qua MQTT, backend co endpoint REST nhan payload dang firmware:

```txt
POST /api/sensors/data
```

Header:

```txt
Content-Type: application/json
X-API-Key: <api-key>
```

Vi du:

```bash
curl -X POST "http://localhost:8000/api/sensors/data" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <api-key>" \
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

Luu y: REST API chi la endpoint backend de test hoac tich hop truc tiep. Ban giao firmware nen uu tien MQTT endpoint.

## Luu y cau hinh hien tai

Trong source firmware, MQTT port dang de `8883`.

Trong Mosquitto config hien tai, listener `1883` da bat, con `8883` TLS dang comment.

Vi vay:

| Moi truong | Nen giao port |
|---|---:|
| Dev/local | 1883 |
| Production khi da bat TLS cert | 8883 |

Neu chua cau hinh TLS cho broker, firmware se khong ket noi duoc port `8883`.

## Tieu chi nghiem thu

1. ESP32 ket noi duoc WiFi va MQTT broker.
2. Server nhan duoc message tren topic `lata/{device_id}/data`.
3. Payload JSON parse duoc va dung ten field.
4. Chu ky gui mac dinh 5 phut hoac theo cau hinh server.
5. Khi mat MQTT, firmware tu reconnect.
6. Khi mat mang, firmware khong crash va co co che log offline.
7. Topic config va OTA subscribe thanh cong.
8. OLED hien thi dung trang thai ket noi va loi co ban.

