# WebApp – Dashboard Real-time (React + Vite)

**Phụ trách:** Nguyễn Khắc Huy · Review: Hoàng Minh Phụng

## Tech stack

- **React 18** + **Vite** – build tool nhanh
- **TailwindCSS** – styling
- **ECharts** (via `echarts-for-react`) – biểu đồ time-series
- **WebSocket** (native API) – nhận dữ liệu real-time từ FastAPI
- **React Query** – data fetching, caching

## Khởi động

```bash
cd webapp/
npm install
npm run dev        # Dev server: http://localhost:5173
npm run build      # Build production → dist/
```

Demo dashboard sẽ gọi trực tiếp các endpoint:

- `GET /api/health`
- `GET /api/devices`
- `GET /api/sensors/latest`
- `GET /api/alerts?status=active`
- `GET /api/logs?limit=8`
- `GET /api/reports/daily?date=YYYY-MM-DD`
- `POST /api/sensors/data`
- `POST /api/devices/:deviceId/pumps/:pumpId/start`
- `POST /api/devices/:deviceId/pumps/:pumpId/stop`

Các lệnh `POST` cần `API_KEY`. Nhập key trong ô API key trên giao diện demo; webapp gửi bằng header `X-API-Key`.

## Chế độ mô phỏng

Khi chưa có thiết bị thật, giao diện quản trị tự mô phỏng 10 chỉ tiêu đo của trạm `lata-001`.

## Xác thực quản trị

Khi mở webapp, người dùng phải nhập mã quản trị trước khi thấy giao diện vận hành.

- Mã đúng mới được vào hệ thống.
- Mã sai không cho vào.
- Nhập sai 3 lần sẽ khóa đăng nhập 1 phút.
- Sau khi đăng xuất hoặc tải lại trang, cần nhập mã lại.

- Số đo tự thay đổi mỗi 5 giây.
- Mỗi chỉ tiêu có một biểu đồ riêng.
- Có 3 chế độ xem thống kê: ngày, tháng, năm.
- Khi không có bơm đang chạy, số đo và biểu đồ sẽ tạm dừng ở giá trị cuối cùng.
- Chỉ bơm thu thập mẫu làm số đo và biểu đồ tiếp tục chạy.
- Sau khi bật bơm thu thập mẫu, webapp chờ 3 lần đo ổn định, mỗi lần cách 5 giây, rồi mới xét điều kiện xả.
- Dữ liệu mô phỏng chỉ chạy trên trình duyệt, không ghi vào cơ sở dữ liệu trừ khi bấm gửi số liệu mẫu.

## Lịch bơm

Trang `Lịch bơm` cho phép chọn trạm, chọn bơm, đặt giờ bơm nước và giờ ngừng nước.

- Đồng hồ trên trang cập nhật theo thời gian thực.
- Khi tới giờ bơm, webapp tự gửi lệnh bật bơm.
- Khi tới giờ ngừng, webapp tự gửi lệnh tắt bơm.
- Giờ bơm nước phải được đặt trước thời điểm bắt đầu ít nhất 1 phút.
- Lịch chỉ hiển thị `đang bơm` sau khi lệnh bật bơm gửi thành công.
- Sau khi lệnh thành công, trạng thái bơm trên giao diện được cập nhật ngay rồi mới tải lại dữ liệu nền.
- Nếu lệnh lỗi, lịch hiển thị lỗi và tự thử lại sau khoảng 10 giây.
- Chỉ được đặt lịch cho bơm thu thập mẫu.
- Lịch hiện được lưu trong trình duyệt bằng `localStorage`; cần mở trang web để lịch tự thực thi.

## Quy tắc xả nước

- Bơm xả không được bật thủ công từ giao diện.
- Khi bơm thu thập mẫu chạy đủ chu kỳ đo và mẫu hiện tại nằm trong khoảng chấp nhận, webapp tự động bật bơm xả.
- Nếu mẫu chỉ sai lệch nhẹ nhưng vẫn nằm trong khoảng chấp nhận, webapp vẫn cho phép xả.
- Nếu có chỉ tiêu vượt ngoài khoảng chấp nhận, webapp tự động ngắt bơm xả.
- Nếu chưa đủ chu kỳ đo, webapp giữ bơm xả ở trạng thái tắt.

## Thống kê tổng quát

Trang `Thống kê tổng quát` phân tích dữ liệu mô phỏng theo ngày, tháng hoặc năm.

- Tổng hợp số chỉ tiêu đạt chuẩn và sai lệch.
- Tách rõ `Đạt chuẩn`, `Chấp nhận` và `Vượt xa`.
- Có 3 biểu đồ chi tiết: biểu đồ tròn tỉ lệ kết luận, biểu đồ cột số lượng từng nhóm, và biểu đồ nhánh phân loại từng chỉ tiêu.
- Hiển thị mức sai lệch cao nhất.
- Bảng phân tích từng chỉ tiêu gồm khoảng chuẩn, trung bình, thấp nhất, cao nhất, kết luận và mức lệch.
- Bảng kết luận dùng 10 chỉ tiêu chất lượng; mỗi lần đo mô phỏng ngẫu nhiên theo tỉ lệ khoảng 60% đạt chuẩn, 20% chấp nhận và 20% sai lệch nặng.

## Cấu trúc

```
src/
├── main.jsx               # Demo dashboard gọi REST API
├── styles.css             # Layout + theme
├── hooks/
│   └── useLiveStream.js   # WebSocket hook – real-time data
```

## Biến môi trường (.env.local)

```
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

Nếu chạy backend qua Nginx ở port 80, đổi API base thành:

```
VITE_API_BASE_URL=http://localhost
```
