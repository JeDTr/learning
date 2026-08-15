# Rate limiting / Throttling

Giới hạn số request/phút của 1 user hoặc IP để chống spam API, brute-force login.

## Pattern: Fixed window counter

```
INCR ratelimit:user:42:2026-08-15T10:05
EXPIRE ratelimit:user:42:2026-08-15T10:05 60
```

- `INCR` là atomic, không sợ race condition khi nhiều request đến cùng lúc.
- Nếu giá trị trả về > giới hạn (ví dụ 100) → từ chối request (HTTP 429).
- `EXPIRE` chỉ cần set ở lần đầu tiên (khi `INCR` trả về 1) để tránh key tồn tại mãi.

## Pattern nâng cao: Sliding window / Token bucket

- Dùng Sorted Set (`ZADD` với timestamp) để đếm chính xác số request trong khoảng trượt thời gian, tránh hiện tượng "burst" ở ranh giới window cố định.
- Token bucket: dùng script Lua để đảm bảo tính atomic khi vừa kiểm tra vừa trừ token.

## Use case

- Giới hạn API public (X request/phút/API key).
- Chống brute-force đăng nhập (X lần thử sai/15 phút/IP).

## Giải pháp thay thế Redis

| Giải pháp | Ưu điểm | Nhược điểm | Khi nào nên dùng |
|---|---|---|---|
| **API Gateway / Nginx rate limit** (`limit_req`, Kong, AWS API Gateway) | Cấu hình sẵn, không cần code thêm, chặn request ngay ở tầng biên trước khi vào app | Kém linh hoạt hơn (khó custom logic phức tạp theo user/plan), mỗi node Nginx có counter riêng nếu không đồng bộ | Giới hạn đơn giản theo IP/route, không cần logic rate limit phức tạp theo business |
| **In-memory counter trong app** (dict/map + timestamp) | Không cần thêm hạ tầng, cực nhanh | Không dùng chung được giữa nhiều instance → mỗi server giới hạn riêng, dễ bị bypass khi có nhiều instance | App chạy 1 instance, hoặc rate limit không cần chính xác tuyệt đối |
| **DB-based counter** | Không cần thêm hạ tầng, tận dụng DB có sẵn | Chậm hơn nhiều, DB không tối ưu cho ghi liên tục tần suất cao, dễ tạo hotspot row | Traffic thấp, đã có DB rảnh tài nguyên, không muốn thêm Redis |
| **Managed service** (Cloudflare Rate Limiting, AWS WAF) | Chặn traffic độc hại từ ngoài biên (edge), giảm tải hoàn toàn cho hệ thống backend | Tốn phí, ít linh hoạt theo logic nghiệp vụ riêng, phụ thuộc nhà cung cấp | Chống DDoS/bot ở tầng network, kết hợp thêm với rate limit ở tầng app cho logic nghiệp vụ |

**Khi nào chọn Redis**: cần rate limit chính xác, dùng chung giữa nhiều instance backend, và logic linh hoạt theo user/API key/endpoint.

## Ví dụ triển khai theo framework

Middleware mẫu: giới hạn 100 request/phút/user bằng `INCR` + `EXPIRE` (fixed window counter).

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều dùng key `ratelimit:user:{userId}:{window phút hiện tại}`, trả về HTTP 429 khi vượt giới hạn.
