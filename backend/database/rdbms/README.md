# RDBMS — Use Cases & Thiết kế Schema

RDBMS (PostgreSQL, MySQL...) phù hợp khi dữ liệu có **quan hệ chặt chẽ**, cần **ACID đầy đủ** (transaction đa bảng), và cấu trúc dữ liệu ổn định theo thời gian. Xem [../comparisons](../comparisons/README.md) để biết khi nào nên chọn RDBMS thay vì Document/Key-Value.

## [mysql-vs-postgres/](mysql-vs-postgres/README.md)

So sánh chi tiết 2 RDBMS mã nguồn mở phổ biến nhất — kiến trúc, kiểu dữ liệu, ràng buộc nâng cao, replication/sharding — kèm case study thực tế (Uber, Facebook, YouTube/Vitess, Instagram).

## [use-cases/](use-cases/) — Các bài toán thực tế

Mỗi bài toán có ERD, DDL (PostgreSQL) và ví dụ triển khai kèm code FastAPI/Laravel/NestJS.

1. [Đặt hàng E-commerce](use-cases/01-ecommerce-order/README.md) — snapshot giá, tránh oversell tồn kho
2. [Quản lý thư viện](use-cases/02-library-loan/README.md) — many-to-many, partial unique index
3. [Đặt phòng khách sạn](use-cases/03-hotel-booking/README.md) — chống double-booking theo khoảng ngày
4. [Mạng xã hội / Blog](use-cases/04-social-network/README.md) — comment lồng nhau, follow
5. [Sổ cái ngân hàng](use-cases/05-bank-ledger/README.md) — double-entry ledger, ACID transaction

## Tổng kết — các mẫu thiết kế lặp lại

| Mẫu thiết kế | Dùng khi nào | Use case |
|---|---|---|
| Bảng trung gian (junction table) | Quan hệ many-to-many | [Thư viện](use-cases/02-library-loan/README.md), [E-commerce](use-cases/01-ecommerce-order/README.md) |
| Composite primary key | Many-to-many không cần metadata riêng, chống trùng tự nhiên | [Mạng xã hội](use-cases/04-social-network/README.md) |
| Self-referencing foreign key | Cấu trúc cây/đồ thị trên cùng 1 entity | [Mạng xã hội](use-cases/04-social-network/README.md) |
| Snapshot dữ liệu (denormalize có chủ đích) | Lịch sử không được đổi theo dữ liệu gốc | [E-commerce](use-cases/01-ecommerce-order/README.md) |
| Partial unique index | Chỉ 1 bản ghi "đang active" tại 1 thời điểm | [Thư viện](use-cases/02-library-loan/README.md) |
| `EXCLUDE` constraint (PostgreSQL) | Chống chồng lấn khoảng giá trị (thời gian, số) | [Đặt phòng khách sạn](use-cases/03-hotel-booking/README.md) |
| Append-only ledger, tính toán thay vì lưu trạng thái | Cần audit trail tuyệt đối, không cho sửa lịch sử | [Sổ cái ngân hàng](use-cases/05-bank-ledger/README.md) |

## Khi nào KHÔNG nên chỉ dùng RDBMS

- Dữ liệu có cấu trúc thay đổi linh hoạt, không cần join nặng (catalog đa thuộc tính, CMS) → cân nhắc thêm Document DB.
- Cần tốc độ đọc/ghi cực nhanh cho dữ liệu tạm thời (session, cache, feed đã build sẵn) → thêm Key-Value/Redis phía trước (xem [../redis/use-cases](../redis/use-cases/README.md)).
- Hệ thống lớn trong thực tế hầu như luôn là **polyglot persistence** — RDBMS cho phần lõi cần ACID, kết hợp Document/Key-Value cho các phần còn lại (xem case study Amazon/Shopee ở [../comparisons](../comparisons/README.md#4-case-study-thực-tế)).
