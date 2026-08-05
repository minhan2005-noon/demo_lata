# Bàn giao kiểm thử firmware DHT22 và MQ2

## Thông tin gửi cho team firmware

```text
Giao thức chính: HTTPS
Method: POST
API URL: https://lata-e10g.onrender.com/api/sensors/data
Dashboard: https://demo-lata-1.onrender.com
Header: Content-Type: application/json
Header: X-API-Key: <bàn giao riêng, không commit lên GitHub>
Device ID: lata-001
Chu kỳ gửi khi test: 5 giây
Payload: JSON
```

Không dùng `https://demo-lata-1.onrender.com` làm `serverName`, vì đó là địa chỉ web dashboard. `serverName` của firmware phải là URL API đầy đủ ở trên.

## Payload test

Payload tối thiểu:

```json
{
  "deviceId": "lata-001",
  "dht22_temperature_c": 29.4,
  "dht22_humidity_percent": 71.2,
  "mq2_raw": 1380
}
```

Nếu MQ2 đã hiệu chuẩn, có thể gửi thêm `mq2_ppm`:

```json
{
  "deviceId": "lata-001",
  "dht22_temperature_c": 29.4,
  "dht22_humidity_percent": 71.2,
  "mq2_raw": 1380,
  "mq2_ppm": 245
}
```

| Field | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---:|---|
| `deviceId` | string | Có | Mã thiết bị, dùng `lata-001` khi test |
| `dht22_temperature_c` | number | Có | Nhiệt độ DHT22, đơn vị C |
| `dht22_humidity_percent` | number | Có | Độ ẩm DHT22, đơn vị % |
| `mq2_raw` | number | Có nếu chưa có ppm | Giá trị ADC thô của MQ2 |
| `mq2_ppm` | number | Không | Giá trị ppm sau khi hiệu chuẩn MQ2 |
| `timestamp` | string | Không | ISO 8601; backend tự tạo thời gian nếu bỏ qua |

Giá trị cảm biến phải là JSON number, ví dụ `29.4`, không gửi dạng chuỗi `"29.4"`.

## Cấu hình code

Từ thư mục `firmware/`:

```bash
cp include/secrets.example.h include/secrets.h
```

Điền API key thật vào `include/secrets.h`. File này đã được `.gitignore` và tuyệt đối không đẩy lên GitHub.

```cpp
#define LATA_API_URL "https://lata-e10g.onrender.com/api/sensors/data"
#define LATA_API_KEY "api-key-duoc-ban-giao-rieng"
#define LATA_DEVICE_ID "lata-001"
#define LATA_MQTT_ENABLED 0
#define LATA_MQTT_BROKER ""
```

## Các bước kiểm thử

1. Pull code mới nhất từ GitHub.
2. Tạo `include/secrets.h` và điền API key được bàn giao riêng.
3. Nối DHT22, MQ2 và kiểm tra nguồn/GND chung với ESP32.
4. Build bằng `pio run`.
5. Nạp code bằng `pio run --target upload`.
6. Mở Serial Monitor bằng `pio device monitor --baud 115200`.
7. Kết nối ESP32 vào WiFi qua điểm truy cập `ESP32_Config` nếu thiết bị chưa lưu WiFi.
8. Chờ log `HTTP: Gửi thành công (201)` hoặc mã `2xx`.
9. Mở dashboard, vào **Kiểm thử phần cứng** và nhập `lata-001`.
10. Bấm **Kiểm tra ngay**; kết quả đạt phải là **Kết nối thật đang hoạt động** và `4/4`.
11. Thử tắt rồi bật WiFi để xác nhận firmware gửi lại sau khi kết nối phục hồi.

## Kết quả đạt

- API production trả trạng thái sẵn sàng.
- Gói dữ liệu thuộc đúng `deviceId` là `lata-001`.
- DHT22 có đủ nhiệt độ và độ ẩm.
- MQ2 có `mq2_raw` hoặc `mq2_ppm`.
- Dữ liệu trên dashboard được cập nhật trong vòng 30 giây.
- Firmware không treo khi API hoặc WiFi tạm thời mất kết nối.

## MQTT tùy chọn

MQTT không phải điều kiện bắt buộc cho bài test production này. Chỉ bật `LATA_MQTT_ENABLED` khi có broker host/port công khai hoặc khi backend và ESP32 cùng mạng LAN. Không điền `localhost`, `mosquitto` hoặc IP LAN của người khác vào firmware production.

MQ2 chỉ nên dùng `mq2_ppm` sau khi đã hiệu chuẩn theo module và loại khí mục tiêu. Trong giai đoạn kiểm tra kết nối, `mq2_raw` là đủ.
