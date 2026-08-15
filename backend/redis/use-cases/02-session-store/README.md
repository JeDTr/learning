# Session store

Lưu session đăng nhập cho web app thay vì lưu file hoặc DB, đặc biệt hữu ích khi có nhiều server (session dùng chung giữa các instance thay vì sticky session).

## Ví dụ

```
SET session:abc123 "{\"userId\":42,\"role\":\"admin\"}" EX 1800
GET session:abc123
DEL session:abc123   # logout
```

- TTL (`EX 1800` = 30 phút) tự động hết hạn session, không cần cron job dọn dẹp.
- Mỗi lần user hoạt động, có thể `EXPIRE session:abc123 1800` để gia hạn (sliding session).

## Lợi ích so với lưu session trong DB

- Đọc/ghi nhanh hơn nhiều, giảm tải cho DB chính.
- Dễ scale horizontal: nhiều server backend cùng đọc chung 1 Redis, không cần sticky session ở load balancer.

## Giải pháp thay thế Redis

| Giải pháp | Ưu điểm | Nhược điểm | Khi nào nên dùng |
|---|---|---|---|
| **JWT (stateless session)** | Không cần lưu trữ server-side, scale ngang cực dễ, không phụ thuộc hạ tầng thêm | Không revoke được token giữa chừng (trừ khi thêm blacklist), payload lớn hơn cookie session id, lộ thông tin nếu decode | API stateless, mobile app, hệ thống microservice cần xác thực không cần tra cứu tập trung |
| **DB-backed session** (bảng `sessions` trong Postgres/MySQL) | Không cần thêm hạ tầng, dữ liệu bền, dễ audit/query | Chậm hơn nhiều, tăng tải DB chính nếu traffic cao, cần cron dọn session hết hạn | Traffic thấp, muốn tối giản hạ tầng, hoặc cần lưu lịch sử session lâu dài |
| **Sticky session + in-memory** (session lưu ngay trong process app) | Nhanh nhất, không cần thêm thành phần | Không scale ngang tốt (phải sticky ở load balancer), mất session khi restart server | App chạy 1 instance hoặc traffic rất nhỏ |
| **Memcached** | Nhanh tương đương Redis cho key-value đơn giản | Không có persistence, không có cấu trúc dữ liệu phong phú để mở rộng sau này | Chỉ cần lưu session dạng key-value thuần, không cần thêm tính năng khác |

**Khi nào chọn Redis**: JWT cũng dùng chung được nhiều server (stateless, không cần Redis), nhưng không revoke/update được giữa chừng. Chọn Redis (session) khi cần **revoke/update session có hiệu lực ngay lập tức** (logout, ban user, đổi quyền) — đây mới là lý do chính, chứ không phải vì JWT không chạy được nhiều server. Ngoài ra có thể tận dụng thêm Redis cho các bài toán khác (rate limit, cache) trong cùng hạ tầng.

## Ví dụ triển khai theo framework

API mẫu: tạo session (login), đọc session (kèm gia hạn TTL), xoá session (logout).

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều dùng key `session:{sessionId}` (UUID), TTL 1800s, và gia hạn TTL (sliding session) mỗi lần đọc.
