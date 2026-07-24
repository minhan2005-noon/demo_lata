#pragma once
#include <Arduino.h>

// Struct lưu toàn bộ dữ liệu đọc từ 1 chu kỳ sampling
struct SensorData {
    unsigned long timestamp;   // millis() khi đọc xong

    float flow_in_m3h;         // Lưu lượng đầu vào - cảm biến siêu âm (m³/h)
    float flow_out_m3h;        // Lưu lượng đầu ra - cảm biến siêu âm (m³/h)
    float ph;                  // pH - cảm biến điện cực pH
    float temperature_c;       // Nhiệt độ - PT100 tích hợp (°C)
    float cod_mgl;             // COD - đầu dò quang phổ UV-VIS (mg/L)
    float bod_mgl;             // BOD ước tính/tính toán từ bộ đo quang phổ (mg/L)
    float toc_mgl;             // TOC ước tính/tính toán từ bộ đo quang phổ (mg/L)
    float do_mgl;              // DO - Dissolved Oxygen (mg/L)
    float ec_mscm;             // EC - độ dẫn điện (mS/cm)
    float color_ptco;          // Color/màu nước (Pt-Co)
    float ammonium_mgl;        // NH4/amoni - điện cực chọn lọc ion (mg/L)
    float tss_mgl;             // Độ đục/TSS - tán xạ ánh sáng hồng ngoại (mg/L)

    // Trạng thái từng cảm biến: true = đọc OK, false = lỗi
    bool flow_in_ok;
    bool flow_out_ok;
    bool ph_ok;
    bool temperature_ok;
    bool cod_ok;
    bool bod_ok;
    bool toc_ok;
    bool do_ok;
    bool ec_ok;
    bool color_ok;
    bool ammonium_ok;
    bool tss_ok;

    // Kiểm tra có ít nhất 1 cảm biến đọc thành công không
    bool anyValid() const {
        return flow_in_ok || flow_out_ok || ph_ok || temperature_ok ||
               cod_ok || bod_ok || toc_ok || do_ok || ec_ok ||
               color_ok || ammonium_ok || tss_ok;
    }
};

// Ngưỡng tham khảo cho cảnh báo vận hành.
// Các giá trị QCVN thực tế cần hiệu chỉnh theo loại nước thải, cột A/B và hệ số K.
namespace QCVN40B {
    constexpr float PH_MIN         = 5.5f;
    constexpr float PH_MAX         = 9.0f;
    constexpr float TEMP_MAX       = 40.0f;
    constexpr float COD_MAX        = 150.0f;
    constexpr float BOD_MAX        = 50.0f;
    constexpr float TOC_MAX        = 50.0f;   // tham khảo nội bộ
    constexpr float DO_MIN         = 2.0f;    // tham khảo vận hành
    constexpr float EC_MAX         = 5.0f;    // mS/cm - tham khảo
    constexpr float COLOR_MAX      = 150.0f;  // Pt-Co - tham khảo
    constexpr float AMMONIUM_MAX   = 10.0f;   // mg/L - tham khảo
    constexpr float TSS_MAX        = 100.0f;  // mg/L

    inline bool phOk(float v)          { return v >= PH_MIN && v <= PH_MAX; }
    inline bool temperatureOk(float v) { return v <= TEMP_MAX; }
    inline bool codOk(float v)         { return v <= COD_MAX; }
    inline bool bodOk(float v)         { return v <= BOD_MAX; }
    inline bool tocOk(float v)         { return v <= TOC_MAX; }
    inline bool doOk(float v)          { return v >= DO_MIN; }
    inline bool ecOk(float v)          { return v <= EC_MAX; }
    inline bool colorOk(float v)       { return v <= COLOR_MAX; }
    inline bool ammoniumOk(float v)    { return v <= AMMONIUM_MAX; }
    inline bool tssOk(float v)         { return v <= TSS_MAX; }
}
