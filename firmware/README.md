# Firmware – ESP32 (PlatformIO)

**Phụ trách:** Nguyễn Khắc Huy (chính) · Hoàng Minh Ân (hỗ trợ phần cứng)

## Yêu cầu cài đặt

- VS Code + **PlatformIO IDE** extension
- **C/C++ (IntelliSense)** extension – Microsoft
- Driver CP2102 hoặc CH340 (tùy board ESP32)

## Cài đặt & Build

```bash
# Mở thư mục firmware/ trong VS Code (không mở thư mục gốc)
# PlatformIO tự nhận platformio.ini

# Build
pio run

# Upload (kết nối ESP32 qua USB)
pio run --target upload

# Serial monitor
pio device monitor --baud 115200
```

## Cấu trúc source

```
src/
├── main.cpp                   # Entry point, FreeRTOS task setup
├── config/
│   ├── config.h               # Định nghĩa hằng số, struct cấu hình
│   └── config.cpp             # Đọc/ghi NVS (WiFi credentials, server URL)
├── sensors/
│   ├── ModbusManager.h/.cpp   # Driver Modbus RTU qua RS485
│   └── SensorData.h           # Struct lưu dữ liệu đọc từ cảm biến
├── connectivity/
│   ├── WiFiProvisioner.h/.cpp # AP mode + captive portal (lần đầu setup)
│   ├── MqttClient.h/.cpp      # Kết nối MQTT, publish, subscribe
│   └── CellularManager.h/.cpp # SIM7600 AT commands (4G primary)
├── storage/
│   └── SDLogger.h/.cpp        # Ghi log CSV vào SD card (offline backup)
└── display/
    └── OledDisplay.h/.cpp     # Hiển thị OLED 128x64
```

## Luồng hoạt động

```
Boot
 │
 ├─ [NVS có WiFi credentials?]
 │     NO  ─→ Khởi động AP "LATA-Setup-XXXXXX"
 │              └─ Web form 192.168.4.1 → nhận SSID + Password + Server URL
 │                   └─ Lưu NVS → Reboot
 │     YES ─→ Kết nối WiFi (hoặc 4G nếu WiFi fail)
 │
 ├─ Kết nối MQTT Broker
 │
 └─ FreeRTOS Tasks:
       ├─ SensorReadTask  (5 phút): Modbus RTU → đọc tất cả cảm biến/đầu dò
       ├─ PublishTask     (sau read): JSON → MQTT publish
       ├─ SDLogTask       (queue):   Ghi CSV backup
       └─ DisplayTask     (5 giây):  Cập nhật OLED
```

## MQTT Topic

```
lata/{device_id}/data      # Publish dữ liệu cảm biến (QoS 1)
lata/{device_id}/alert     # Publish cảnh báo vượt ngưỡng
lata/{device_id}/config    # Subscribe nhận cấu hình từ server
lata/{device_id}/ota       # Subscribe nhận lệnh OTA update
```

## Payload cảm biến chính

| Trường firmware | Chỉ tiêu | Thiết bị đo | Đơn vị |
|---|---|---|---|
| `flow_in_m3h` | Lưu lượng đầu vào | Cảm biến siêu âm | m3/h |
| `flow_out_m3h` | Lưu lượng đầu ra | Cảm biến siêu âm | m3/h |
| `ph` | pH | Cảm biến điện cực pH | pH |
| `temperature_c` | Nhiệt độ | PT100 tích hợp | C |
| `cod_mgl` | COD | Đầu dò quang phổ UV-VIS | mg/L |
| `bod_mgl` | BOD | Ước tính/tính toán từ đầu dò quang học | mg/L |
| `toc_mgl` | TOC | Ước tính/tính toán từ đầu dò quang học | mg/L |
| `do_mgl` | DO | Đầu dò oxy hòa tan | mg/L |
| `ec_mscm` | EC | Đầu dò độ dẫn điện | mS/cm |
| `color_ptco` | Color | Đo màu quang học | Pt-Co |
| `ammonium_mgl` | NH4/Amoni | Điện cực chọn lọc ion | mg/L |
| `tss_mgl` | TSS/Độ đục | Cảm biến tán xạ ánh sáng hồng ngoại | mg/L |

## Thư viện (xem platformio.ini)

| Thư viện | Mục đích |
|---|---|
| `4-20ma/ModbusMaster` | Modbus RTU master qua RS485 |
| `knolleary/PubSubClient` | MQTT client |
| `bblanchon/ArduinoJson` | Serialize/deserialize JSON payload |
| `me-no-dev/ESP Async WebServer` | Web server cho AP provisioning |
| `adafruit/Adafruit SSD1306` | Driver OLED 128x64 |
| `adafruit/RTClib` | DS3231 RTC |
