#pragma once
#include "../sensors/SensorData.h"

// MQTT Client wrapper – publish dữ liệu cảm biến lên broker
//
// Topic format:
//   lata/{device_id}/data     – JSON payload dữ liệu cảm biến:
//     flow_in_m3h, flow_out_m3h, ph, temperature_c, cod_mgl, bod_mgl,
//     toc_mgl, do_mgl, ec_mscm, color_ptco, ammonium_mgl, tss_mgl
//   lata/{device_id}/alert    – JSON cảnh báo vượt ngưỡng QCVN
//   lata/{device_id}/config   – Subscribe nhận cấu hình từ server
//   lata/{device_id}/ota      – Subscribe nhận lệnh OTA

namespace MqttClient {
    void begin();
    void ensureConnected();    // Reconnect nếu mất kết nối
    void publish(const SensorData& data);
    void loop();               // Gọi trong task để xử lý incoming messages
}
