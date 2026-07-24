#pragma once

// WiFi Provisioning – AP Mode (lần đầu thiết lập)
//
// Luồng:
//   1. ESP32 bật AP "LATA-Setup-XXXXXX"
//   2. Người dùng kết nối vào AP bằng điện thoại/laptop
//   3. Mở trình duyệt → 192.168.4.1 → điền SSID + Password + Server URL
//   4. ESP32 lưu NVS → reboot → kết nối WiFi thật (STA mode)

namespace WiFiProvisioner {
    // Bật AP mode và chờ user cấu hình (blocking cho đến khi reboot)
    void startAPMode();

    // Kết nối WiFi với credentials đã lưu trong NVS
    // Trả về true nếu kết nối thành công
    bool connectSTA();

    // Quay lại AP mode (gọi khi WiFi mất kết nối quá N lần)
    void resetToAPMode();
}
