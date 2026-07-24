# LATA – Hệ thống IoT Quan trắc Nước thải Công nghiệp

> Dự án hợp tác giữa **LAZINET Technologies** và **Tâm Nguyên Environmental Services**

## Tổng quan

LATA là hệ thống đo quan trắc nước thải công nghiệp tự động, liên tục, thời gian thực. Thiết bị đọc dữ liệu từ cảm biến RS485/Modbus và các đầu dò chuyên dụng: lưu lượng đầu vào/đầu ra bằng cảm biến siêu âm, pH điện cực, nhiệt độ PT100, COD/BOD/TOC bằng đầu dò quang phổ UV-VIS hoặc mô hình quang học, DO, EC, color, NH4/amoni bằng điện cực chọn lọc ion, và TSS/độ đục bằng cảm biến tán xạ ánh sáng hồng ngoại. Dữ liệu được truyền lên cloud qua 4G/WiFi, hiển thị dashboard web real-time và gửi cảnh báo tự động.

## Kiến trúc hệ thống

```
[Cảm biến RS485] ──MAX485──> [ESP32] ──4G/WiFi──> [MQTT Broker]
                                                        │
                                              [Node-RED / Processor]
                                                        │
                                                  [InfluxDB]
                                                        │
                                          [FastAPI] ──> [WebApp]
```

## Cấu trúc thư mục

| Thư mục | Mô tả | Phụ trách |
|---|---|---|
| [`firmware/`](firmware/) | ESP32 firmware (PlatformIO/C++) | Khắc Huy + Minh Ân + Trọng Phát |
| [`hardware/`](hardware/) | Schematic, PCB Altium, BOM | Minh Ân + Trọng Phát |
| [`backend/`](backend/) | Docker stack: MQTT, InfluxDB, API | Khắc Huy |
| [`webapp/`](webapp/) | React dashboard real-time | Khắc Huy |
| [`docs/`](docs/) | Tài liệu kỹ thuật, đặc tả cảm biến | Toàn nhóm |

> **Phân công chi tiết** sẽ được cập nhật theo tiến độ dự án.

> **Lưu ý:** Thư mục `initial/` chứa tài liệu dự án (proposal, kế hoạch) **không** được đồng bộ lên GitHub.

## Quy trình làm việc với GitHub

1. **Không push thẳng lên `main`** – luôn tạo branch mới và Pull Request
2. Branch đặt tên theo format: `<loại>/<mô-tả-ngắn>`
   - `feat/modbus-ph-sensor`
   - `fix/mqtt-reconnect`
   - `docs/cwt-ph-datasheet`
3. Mỗi PR cần ít nhất **1 người review và approve** trước khi merge
4. Xem file [`.github/CODEOWNERS`](.github/CODEOWNERS) để biết ai review thư mục nào

## Họp nhóm

- **Định kỳ:** Thứ 7 hàng tuần, 08:00 (Google Meet)
- **Báo cáo tiến độ:** Cập nhật Google Sheets trước 20:00 Thứ 6
- **Kế hoạch chi tiết:** [Google Sheets](https://docs.google.com/spreadsheets/d/1cik_m1V6-LAzipzpgVx-lvuFbpol3CPPCjiHqCkcEb4)

## Liên hệ

| # | Tên | Vai trò | Email | SĐT |
|---|---|---|---|---|
| 1 | Hoàng Minh Phụng | Trưởng kỹ thuật (LAZINET) | email@lazinet.com | — |
| 2 | Trương Thị Ngọc Thảo | Chuyên gia môi trường (Tâm Nguyên) | — | — |
| 3 | Nguyễn Khắc Huy | Thực tập sinh – Firmware & Backend | khachuy11@gmail.com | 0329507622 |
| 4 | Hoàng Minh Ân | Thực tập sinh – Hardware & PCB | hoangminhan2468@gmail.com | 0938508330 |
| 5 | Nguyễn Trọng Phát | Thực tập sinh – Hardware & PCB | phatnguyen1962005@gmail.com | 0797190605 |
