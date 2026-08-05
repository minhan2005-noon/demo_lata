#pragma once

// Sao chép file này thành include/secrets.h rồi điền API key thật.
// include/secrets.h đã được .gitignore và không được đẩy lên GitHub.
#define LATA_API_URL "https://lata-e10g.onrender.com/api/sensors/data"
#define LATA_API_KEY "dien-api-key-vao-day"
#define LATA_DEVICE_ID "lata-001"

// HTTP API là đường gửi chính. Chỉ bật MQTT khi có broker truy cập được.
#define LATA_MQTT_ENABLED 0
#define LATA_MQTT_BROKER ""
#define LATA_MQTT_PORT 1883
#define LATA_MQTT_TOPIC "lata/lata-001/data"
