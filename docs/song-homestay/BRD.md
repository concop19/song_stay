# Business Requirements Document

## Tác nhân

- Khách hàng: xem căn, đặt phòng, chọn dịch vụ, quản lý booking, cung cấp thông tin lưu trú.
- Lễ tân/Admin: xem lịch, nhập booking ngoài, đồng bộ iCal, xử lý trùng, quản lý căn/dịch vụ.
- Hệ thống OTA giả lập: cung cấp sự kiện `.ics` theo từng căn.

## Yêu cầu chức năng

| ID | Yêu cầu | Tiêu chí chấp nhận |
|---|---|---|
| FR01 | Xem danh sách căn | Hiển thị loại căn, sức chứa, tiện nghi, giá VND |
| FR02 | Xem lịch trống | Ngày bị giữ/đã đặt/iCal không thể chọn |
| FR03 | Đặt phòng web | Tạo booking, khóa tất cả đêm đã chọn trong một transaction |
| FR04 | Dịch vụ bổ sung | Chọn số lượng; tên/giá được snapshot vào booking |
| FR05 | Thanh toán tại homestay | Xác nhận booking mà không gọi cổng thanh toán thật |
| FR06 | Booking thủ công | Admin nhập Zalo/Facebook/điện thoại/vãng lai và khóa lịch ngay |
| FR07 | Calendar tập trung | Một lưới hiển thị booking web, thủ công và OTA theo căn |
| FR08 | Đồng bộ iCal | Nút Đồng bộ ngay đọc mọi feed cấu hình của property |
| FR09 | Chống nhập trùng iCal | Cùng UID đồng bộ lại không tạo bản ghi trùng |
| FR10 | Phát hiện double booking | Hai khoảng giao nhau trên cùng căn sinh cảnh báo |
| FR11 | Quy tắc biên ngày | Checkout của booking A bằng checkin booking B không bị xem là trùng |
| FR12 | Xử lý xung đột | Cho phép đổi căn, hủy hoặc xác nhận đã xử lý trên OTA |
| FR13 | Quản lý căn | Thêm căn, đổi tên, đổi trạng thái; không offline căn có booking hoạt động |
| FR14 | Quản lý dịch vụ | Thêm/sửa giá/đơn vị/thuế và bật/tắt dịch vụ |
| FR15 | Thông tin lưu trú | Khách nhập theo booking; admin xem và xác nhận |
| FR16 | Nguồn iCal theo căn | Cấu hình nhiều URL/nhãn và xem lần đồng bộ/trạng thái |

## Quy tắc nghiệp vụ

- BR01: Check-in bao gồm, check-out loại trừ; khoảng lưu trú là `[checkIn, checkOut)`.
- BR02: `unitNights` là nguồn sự thật của tình trạng chiếm dụng.
- BR03: Booking hoạt động không được ghi đè đêm đã chiếm.
- BR04: iCal không tự hủy booking nội bộ; chỉ ghi cảnh báo.
- BR05: Sự kiện iCal biến mất khỏi feed sẽ bị hủy và giải phóng lịch.
- BR06: Chuyển căn để xử lý xung đột giữ nguyên giá booking.
- BR07: Booking thủ công phải lưu nguồn.
- BR08: Dịch vụ trong booking lưu snapshot tên và giá để lịch sử không đổi.
- BR09: CCCD/hộ chiếu không xuất hiện trong feed iCal hoặc API công khai.
- BR10: API OTA thật và thanh toán trực tuyến thật nằm ngoài scope.

## Yêu cầu phi chức năng

- NFR01: Đồng bộ thủ công có phản hồi từng feed; một feed lỗi không dừng feed khác.
- NFR02: Booking conflict check chạy trong transaction của Convex.
- NFR03: Mọi thao tác admin ngoài demo cần đăng nhập và capability theo property.
- NFR04: Giao diện dùng được ở chiều rộng 390px và desktop.
- NFR05: Tiền lưu dưới dạng integer cents; ngày lưu `YYYY-MM-DD` theo timezone property.
- NFR06: `npm run typecheck`, `npm test`, `npm run build` phải đạt trước nghiệm thu.

## Ma trận mục tiêu–chức năng

| Mục tiêu | Chức năng chứng minh |
|---|---|
| O1 | FR02, FR03, FR08–FR12 |
| O2 | FR08, FR16 và cron 15 phút |
| O3 | FR12 với đổi căn/hủy/xác nhận OTA |
| O4 | FR06–FR08 |
| O5 | FR01–FR05 |
| O6 | FR04, FR14 |

