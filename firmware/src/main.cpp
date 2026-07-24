#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>

#include "config/config.h"
#include "sensors/ModbusManager.h"
#include "sensors/SensorData.h"
#include "connectivity/WiFiProvisioner.h"
#include "connectivity/MqttClient.h"
#include "storage/SDLogger.h"
#include "display/OledDisplay.h"

// ── Queues giữa các task ──────────────────────────────────────────────────
QueueHandle_t sensorQueue;    // SensorReadTask → PublishTask + SDLogTask

// ── Forward declarations ──────────────────────────────────────────────────
void taskReadSensors(void* pvParameters);
void taskPublishMQTT(void* pvParameters);
void taskSDLog(void* pvParameters);
void taskDisplay(void* pvParameters);

// ─────────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    Serial.println("\n=== LATA Firmware booting ===");

    // 1. Load cấu hình từ NVS
    Config::load();

    // 2. Nếu chưa có WiFi credentials → bật AP mode để cấu hình
    if (!Config::hasCredentials()) {
        Serial.println("[Setup] No credentials found, starting AP provisioning...");
        WiFiProvisioner::startAPMode();
        // startAPMode() không return cho đến khi user đã nhập xong và thiết bị reboot
    }

    // 3. Kết nối WiFi (hoặc 4G nếu WiFi fail)
    if (!WiFiProvisioner::connectSTA()) {
        Serial.println("[Setup] WiFi failed, falling back to cellular...");
        // CellularManager::connect();  // TODO: GĐ2 – tích hợp SIM7600
    }

    // 4. Khởi động các module
    ModbusManager::begin();
    SDLogger::begin();
    OledDisplay::begin();
    MqttClient::begin();

    // 5. Tạo queues
    sensorQueue = xQueueCreate(10, sizeof(SensorData));

    // 6. Tạo FreeRTOS tasks
    xTaskCreate(taskReadSensors, "SensorRead", 4096, NULL, 3, NULL);
    xTaskCreate(taskPublishMQTT, "MQTTPublish", 4096, NULL, 2, NULL);
    xTaskCreate(taskSDLog,       "SDLog",       2048, NULL, 1, NULL);
    xTaskCreate(taskDisplay,     "Display",     2048, NULL, 1, NULL);

    Serial.println("[Setup] All tasks started.");
}

void loop() {
    // FreeRTOS quản lý – loop() không dùng
    vTaskDelay(portMAX_DELAY);
}

// ─────────────────────────────────────────────────────────────────────────
// Task 1: Đọc cảm biến theo chu kỳ (mặc định 5 phút)
// ─────────────────────────────────────────────────────────────────────────
void taskReadSensors(void* pvParameters) {
    const TickType_t interval = pdMS_TO_TICKS(Config::getSampleIntervalMs());
    SensorData data;

    while (true) {
        if (ModbusManager::readAll(data)) {
            data.timestamp = millis();
            xQueueSend(sensorQueue, &data, pdMS_TO_TICKS(1000));
        } else {
            Serial.println("[SensorRead] Read failed – check RS485 wiring");
        }
        vTaskDelay(interval);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Task 2: Publish dữ liệu lên MQTT
// ─────────────────────────────────────────────────────────────────────────
void taskPublishMQTT(void* pvParameters) {
    SensorData data;

    while (true) {
        if (xQueueReceive(sensorQueue, &data, portMAX_DELAY) == pdTRUE) {
            MqttClient::ensureConnected();
            MqttClient::publish(data);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Task 3: Ghi log vào SD card (backup offline)
// ─────────────────────────────────────────────────────────────────────────
void taskSDLog(void* pvParameters) {
    SensorData data;

    while (true) {
        // Peek queue mà không lấy ra – hoặc dùng queue riêng nếu cần
        // TODO: implement separate log queue
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Task 4: Cập nhật màn hình OLED mỗi 5 giây
// ─────────────────────────────────────────────────────────────────────────
void taskDisplay(void* pvParameters) {
    while (true) {
        OledDisplay::update();
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}
