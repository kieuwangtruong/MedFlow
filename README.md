VAIC2026-TuTru Project

## Tài khoản bác sĩ demo

> Chỉ sử dụng các tài khoản dưới đây trong môi trường demo/development. Mật khẩu production phải được đặt riêng bằng biến môi trường `SEED_DOCTOR_PASSWORD` và không được ghi vào repository.

Mật khẩu demo mặc định: `12345678`

| Mã phòng | Phòng khám | Bác sĩ | Tài khoản | Trạng thái ca trực demo |
|---|---|---|---|---|
| `PK-TQ-101` | Tổng quát 101 | BS. Nguyễn Minh Khang | `bs.nguyen.minh.khang@vaic.vn` | Đang gán |
| `CC-102` | Phân loại Cấp cứu 102 | BS. Nguyễn Văn Nam | `nam01@gmail.com` | Đang gán |
| `TM-201` | Tim mạch 201 | BS. Lê Quang Huy | `bs.le.quang.huy@vaic.vn` | Đang gán |
| `TK-202` | Thần kinh 202 | BS. Phạm Thu Hà | `bs.pham.thu.ha@vaic.vn` | Đang gán |
| `TMH-203` | Tai Mũi Họng 203 | BS. Võ Thành Đạt | `bs.vo.thanh.dat@vaic.vn` | Đang gán |
| `DL-204` | Da liễu 204 | BS. Đặng Ngọc Anh | `bs.dang.ngoc.anh@vaic.vn` | Đang gán |
| `NK-301` | Nhi 301 | BS. Bùi Tuấn Kiệt | `bs.bui.tuan.kiet@vaic.vn` | Đang gán |
| `SPK-302` | Sản Phụ khoa 302 | BS. Đỗ Mỹ Linh | `bs.do.my.linh@vaic.vn` | Đang gán |
| `CXK-303` | Cơ Xương Khớp 303 | BS. Hoàng Gia Bảo | `bs.hoang.gia.bao@vaic.vn` | Đang gán |
| `TH-304` | Tiêu hóa - Gan mật 304 | BS. Ngô Thanh Vân | `bs.ngo.thanh.van@vaic.vn` | Đang gán |
| `HH-401` | Hô hấp 401 | BS. Nguyễn Minh Khang | `bs.nguyen.minh.khang@vaic.vn` | Chưa có ca trực riêng |
| `TN-402` | Tiết niệu 402 | BS. Lê Quang Huy | `bs.le.quang.huy@vaic.vn` | Chưa có ca trực riêng |
| `MAT-403` | Mắt 403 | BS. Trần Hoàng Lan | `bs.tran.hoang.lan@vaic.vn` | Đang gán |
| `NT-404` | Nội tiết 404 | BS. Phạm Thu Hà | `bs.pham.thu.ha@vaic.vn` | Chưa có ca trực riêng |
| `TTL-405` | Tâm thần - Tâm lý 405 | BS. Đặng Ngọc Anh | `bs.dang.ngoc.anh@vaic.vn` | Chưa có ca trực riêng |

Một bác sĩ có thể phụ trách nhiều phòng, nhưng dữ liệu demo chỉ tạo một ca trực đang hoạt động cho phòng đầu tiên của bác sĩ đó.

## Data Analytics

Bộ EDA, SQL, baseline comparison, dashboard ba trang và báo cáo vận hành nằm tại [analytics/README.md](analytics/README.md). Dashboard ưu tiên PostgreSQL qua `DATABASE_URL` và tự động fallback sang dữ liệu demo đã seed.

## Wait-Time, queue assignment và chạy demo

Wait-Time Module định giá candidate rooms bằng P50/P80/P90 và assignment impact, nhưng không trả `selected_room`; Routing Agent bên ngoài mới chọn phòng và commit bằng event có estimate version. Luồng local một worker, restart/idempotency SQLite, requote, audit, model fallback, OpenAPI và smoke test đã được kiểm chứng. Model và analytics hiện là **SYNTHETIC_ONLY** và **NOT_CLINICALLY_VALIDATED**; PostgreSQL multi-process và deployment bên ngoài là **CONFIGURED_NOT_DEPLOYED/PARTIAL**.

- [Kiến trúc](docs/ARCHITECTURE.md)
- [API contract](docs/API_CONTRACT.md)
- [Cách chạy demo](docs/INTEGRATION_GUIDE.md)
- [Routing Agent handoff](docs/ROUTING_AGENT_HANDOFF.md)
- [Hạn chế](docs/LIMITATIONS.md)
- [Báo cáo xác minh kỹ thuật](docs/VERIFICATION_REPORT.md)
