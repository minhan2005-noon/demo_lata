# Kiểm thử firmware bằng DHT22 và MQ2

## Thông tin gửi cho team firmware

```text
Protocol: MQTT
Broker host khi test: <IP LAN của máy chạy backend>
Broker port khi test: 1883
QoS: 1
Device ID: lata-001
Publish topic: lata/lata-001/data
Chu kỳ gửi khi test: 3-5 giây
Payload: JSON
```

Không dùng `localhost` hoặc `mosquitto` làm broker host trên ESP32. Firmware phải dùng IP LAN của máy đang chạy backend, ví dụ `192.168.x.x`.

## Payload test

Payload tối thiểu:

```json
{
  "dht22_temperature_c": 29.4,
  "dht22_humidity_percent": 71.2,
  "mq2_raw": 1380
}
```

Nếu MQ2 đã hiệu chuẩn, có thể gửi thêm `mq2_ppm`:

```json
{
  "dht22_temperature_c": 29.4,
  "dht22_humidity_percent": 71.2,
  "mq2_raw": 1380,
  "mq2_ppm": 245
}
```

| Field | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---:|---|
| `dht22_temperature_c` | number | Có | Nhiệt độ DHT22, đơn vị C |
| `dht22_humidity_percent` | number | Có | Độ ẩm DHT22, đơn vị % |
| `mq2_raw` | number | Có nếu chưa có ppm | Giá trị ADC thô của MQ2 |
| `mq2_ppm` | number | Không | Giá trị ppm sau khi hiệu chuẩn MQ2 |
| `timestamp` | string | Không | ISO 8601; bỏ qua nếu firmware chưa có NTP/RTC |

Giá trị cảm biến phải là JSON number, không gửi dạng chuỗi. Ví dụ dùng `29.4`, không dùng `"29.4"`.

## Các bước kiểm thử

1. Nối DHT22 và MQ2 vào ESP32, kiểm tra Serial Monitor đọc được giá trị hợp lệ.
2. Cấu hình ESP32 và máy chạy backend vào cùng một mạng LAN.
3. Điền broker host bằng IP LAN của máy backend và port `1883`.
4. Kết nối MQTT và subscribe/publish với QoS 1.
5. Publish payload lên `lata/lata-001/data` mỗi 3-5 giây trong phiên test.
6. Mở dashboard, đăng nhập và chọn `Test firmware`.
7. Kiểm tra `Device ID` là `lata-001`.
8. Chờ giao diện hiển thị `Kết nối thật đang hoạt động` và kết quả `4/4`.
9. Thử rút dây DHT22 hoặc MQ2 để xác nhận giao diện báo thiếu chỉ số.
10. Thử tắt WiFi rồi bật lại để xác nhận firmware tự reconnect và tiếp tục publish.

## Kết quả đạt

- Backend báo MQTT Broker online.
- Gói gần nhất đến từ đúng `lata-001`.
- DHT22 có đủ nhiệt độ và độ ẩm.
- MQ2 có `mq2_raw` hoặc `mq2_ppm`.
- Dữ liệu mới tự cập nhật trên giao diện trong vòng 3 giây.
- Firmware không treo khi mất WiFi hoặc MQTT và tự gửi lại sau khi kết nối phục hồi.

## Test broker không cần ESP32

```bash
mosquitto_pub \
  -h <IP-LAN-MAY-BACKEND> \
  -p 1883 \
  -q 1 \
  -t lata/lata-001/data \
  -m '{"dht22_temperature_c":29.4,"dht22_humidity_percent":71.2,"mq2_raw":1380,"mq2_ppm":245}'
```

MQ2 chỉ nên dùng `mq2_ppm` sau khi đã hiệu chuẩn theo điện trở tải, điện trở cảm biến trong không khí sạch và loại khí mục tiêu. Trong giai đoạn kiểm tra kết nối, `mq2_raw` là đủ để xác nhận đường truyền hoạt động.
