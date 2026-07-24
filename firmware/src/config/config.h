#pragma once
#include <Arduino.h>

// ── GPIO Map ──────────────────────────────────────────────────────────────
#define PIN_RS485_RX      16
#define PIN_RS485_TX      17
#define PIN_RS485_DE_RE    4

#define PIN_SDA           21
#define PIN_SCL           22

#define PIN_SD_CS          5
#define PIN_SD_CLK        18
#define PIN_SD_MISO       19
#define PIN_SD_MOSI       23

#define PIN_4G_RX         26
#define PIN_4G_TX         27
#define PIN_4G_PWR        25

// ── Cấu hình RS485 / Modbus ───────────────────────────────────────────────
#define RS485_BAUD        9600
#define MODBUS_TIMEOUT_MS 500

// ── AP Provisioning ───────────────────────────────────────────────────────
#define AP_SSID_PREFIX    "LATA-Setup-"
#define AP_IP             "192.168.4.1"
#define AP_TIMEOUT_MS     300000   // 5 phút – sau đó reboot nếu chưa cấu hình

// ── MQTT ─────────────────────────────────────────────────────────────────
#define MQTT_PORT         8883
#define MQTT_QOS          1
#define MQTT_KEEPALIVE    60

// ── Sampling ─────────────────────────────────────────────────────────────
#define DEFAULT_SAMPLE_INTERVAL_MS  (5 * 60 * 1000)   // 5 phút

namespace Config {
    struct Settings {
        char wifiSSID[64];
        char wifiPassword[64];
        char mqttServer[128];
        char deviceId[32];
        uint32_t sampleIntervalMs;
    };

    void load();
    void save(const Settings& s);
    void clear();                    // Xóa NVS – reset về factory
    bool hasCredentials();

    const char* getDeviceId();
    const char* getMqttServer();
    const char* getWifiSSID();
    const char* getWifiPassword();
    uint32_t    getSampleIntervalMs();
}
