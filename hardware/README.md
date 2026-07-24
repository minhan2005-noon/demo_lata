# Hardware – Schematic & PCB (Altium Designer)

**Phụ trách:** Hoàng Minh Ân (chính) · Review: Hoàng Minh Phụng

## Công cụ

- **Altium Designer** (trial hoặc license) – thiết kế schematic + PCB layout
- **KiCad 7+** – thay thế miễn phí nếu hết trial Altium
- Sản xuất PCB: **JLCPCB** (jlcpcb.com) – export Gerber + BOM + CPL

## Cấu trúc

```
hardware/
├── schematic/      # File schematic Altium (.SchDoc) / KiCad (.kicad_sch)
├── pcb/            # File PCB layout (.PcbDoc) / KiCad (.kicad_pcb)
├── bom/            # Bill of Materials (Excel/CSV)
└── enclosure/      # Bản vẽ vỏ hộp, kích thước, file DXF/STL
```

## Sơ đồ khối phần cứng

```
AC 220V
   │
[12V/2A Adapter]
   │
[Buck 12V→5V]──────────────[SIM7600 4G Module]──── Ăng-ten ngoài
   │
[LDO 5V→3.3V]──────────────[ESP32-WROOM-32U]
                                 │    │    │
                           UART1 │  UART2  │ I2C/SPI
                                 │         │
                            [MAX485]   [DS3231 RTC]
                                 │    [ADS1115 ADC]
                            RS485 Bus  [SD Card]
                                 │    [OLED 0.96"]
                    ┌────────────┼────────────┐
       [Flow In/Out Ultrasonic] [pH Electrode] [PT100]
       [UV-VIS COD/BOD/TOC] [DO] [EC] [Color]
       [NH4 Ion-selective] [Infrared TSS/Turbidity]
```

## GPIO Map (ESP32)

| GPIO | Chức năng | Ghi chú |
|---|---|---|
| 16 (RX1) | RS485 RX | UART1 |
| 17 (TX1) | RS485 TX | UART1 |
| 4 | RS485 DE/RE | MAX485 direction |
| 21 (SDA) | I2C Data | DS3231 + ADS1115 + OLED |
| 22 (SCL) | I2C Clock | |
| 5 (CS) | SD Card CS | SPI |
| 18 (CLK) | SPI Clock | SD Card |
| 19 (MISO) | SPI MISO | SD Card |
| 23 (MOSI) | SPI MOSI | SD Card |
| 26 (RX2) | 4G RX | UART2 – SIM7600 |
| 27 (TX2) | 4G TX | UART2 – SIM7600 |
| 25 | 4G PWR Key | Bật/tắt module |
| 32–35 | Relay outputs | Điều khiển bơm/van |

## Quy trình đặt PCB tại JLCPCB

1. Export Gerber files từ Altium (Fabrication Outputs → Gerber Files)
2. Export BOM + CPL (Pick & Place) nếu muốn PCBA
3. Upload lên jlcpcb.com → kiểm tra preview → đặt hàng
4. Thời gian: 3–5 ngày sản xuất + 7–14 ngày ship
