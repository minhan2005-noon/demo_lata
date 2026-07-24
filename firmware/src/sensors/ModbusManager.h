#pragma once
#include "SensorData.h"

// Quản lý toàn bộ giao tiếp Modbus RTU qua RS485
// Mỗi cảm biến/đầu dò có địa chỉ Modbus riêng, đọc tuần tự theo chu kỳ.
//
// Tham khảo datasheet CWT/ComWinTop trong docs/sensors/cwt/

namespace ModbusManager {
    void begin();

    // Đọc tất cả cảm biến đã đăng ký, điền vào SensorData
    // Trả về true nếu ít nhất 1 cảm biến đọc thành công
    bool readAll(SensorData& out);

    // Đọc từng cảm biến riêng lẻ (dùng khi test)
    bool readFlowIn(float& flow_m3h);       // Lưu lượng đầu vào - siêu âm
    bool readFlowOut(float& flow_m3h);      // Lưu lượng đầu ra - siêu âm
    bool readPH(float& ph);                 // Điện cực pH
    bool readTemperature(float& temp_c);    // PT100 tích hợp
    bool readCOD(float& cod_mgl);           // Quang phổ UV-VIS
    bool readBOD(float& bod_mgl);           // BOD ước tính/tính toán
    bool readTOC(float& toc_mgl);           // TOC ước tính/tính toán
    bool readDO(float& do_mgl);
    bool readTSS(float& tss_mgl);           // Độ đục/TSS - tán xạ hồng ngoại
    bool readEC(float& ec_mscm);
    bool readColor(float& color_ptco);
    bool readAmmonium(float& ammonium_mgl); // NH4/amoni - điện cực chọn lọc ion
}
