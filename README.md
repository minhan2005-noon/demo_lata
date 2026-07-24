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
