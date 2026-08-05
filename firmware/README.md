# Firmware ESP32 - DHT22 và MQ2

Firmware đọc cảm biến DHT22, MQ2 và gửi dữ liệu thật lên LATA bằng HTTP API. MQTT là kênh tùy chọn và mặc định đang tắt vì cần một broker mà ESP32 có thể truy cập.

## 1. Cài đặt

- VS Code và PlatformIO IDE
- Driver USB CP2102 hoặc CH340 tùy board ESP32
- ESP32 Dev Module, DHT22 và MQ2

## 2. Cấu hình bí mật

Từ thư mục `firmware/`, tạo file cấu hình riêng:

```bash
cp include/secrets.example.h include/secrets.h
```

Mở `include/secrets.h` và điền API key thật:

```cpp
#define LATA_API_URL "https://lata-e10g.onrender.com/api/sensors/data"
#define LATA_API_KEY "api-key-duoc-ban-giao-rieng"
#define LATA_DEVICE_ID "lata-001"
```

Không gửi API key qua tin nhắn công khai và không commit `include/secrets.h`. File này đã được thêm vào `.gitignore`.

## 3. Đấu nối đang dùng

| Thiết bị | Chân ESP32 |
|---|---|
| DHT22 DATA | GPIO 15 |
| MQ2 AO | GPIO 34 |
| Buzzer | GPIO 25 |
| LED cảnh báo | GPIO 27 |
| Relay quạt | GPIO 26 |
| Nút điều khiển | GPIO 32 |

DHT22 và MQ2 phải dùng chung GND với ESP32. Kiểm tra điện áp ngõ analog của module MQ2 trước khi nối vào ESP32 vì chân ADC của ESP32 không chịu được 5 V.

## 4. Build và nạp code

```bash
pio run
pio run --target upload
pio device monitor --baud 115200
```

Firmware gửi dữ liệu mỗi 5 giây. Khi hoạt động đúng, Serial Monitor sẽ hiện WiFi đã kết nối, payload JSON và mã HTTP thành công `2xx` (thường là `201`).

## 5. API bàn giao cho firmware

- Dashboard: `https://demo-lata-1.onrender.com`
- Method: `POST`
- URL: `https://lata-e10g.onrender.com/api/sensors/data`
- Header: `Content-Type: application/json`
- Header: `X-API-Key: <API key được bàn giao riêng>`

Payload:

```json
{
  "deviceId": "lata-001",
  "dht22_temperature_c": 29.4,
  "dht22_humidity_percent": 71.2,
  "mq2_raw": 1380,
  "gas_alert": false,
  "led_status": false,
  "fan_status": false,
  "fan_mode": 0
}
```

Các field bắt buộc để trang kiểm thử đạt đủ trạng thái:

- `deviceId`
- `dht22_temperature_c`
- `dht22_humidity_percent`
- `mq2_raw` hoặc `mq2_ppm`

## 6. Kiểm tra trên dashboard

1. Nạp firmware và mở Serial Monitor.
2. Đăng nhập dashboard.
3. Mở trang **Kiểm thử phần cứng**.
4. Nhập `deviceId` giống `LATA_DEVICE_ID`, mặc định là `lata-001`.
5. Bấm **Kiểm tra ngay**.
6. Khi API nhận đủ dữ liệu mới từ DHT22 và MQ2, dashboard hiển thị **Kết nối thật đang hoạt động** và chẩn đoán `4/4`.

## 7. MQTT tùy chọn

MQTT mặc định tắt:

```cpp
#define LATA_MQTT_ENABLED 0
```

Vì vậy `LATA_MQTT_BROKER` được để trống và firmware vẫn gửi HTTP bình thường. Chỉ chuyển thành `1` sau khi có broker host/port mà cả backend và ESP32 đều truy cập được. Không dùng IP LAN như `192.168.x.x` cho production nếu backend chạy trên Render.
