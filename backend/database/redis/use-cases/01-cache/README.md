# Cache

Cache kết quả query DB tốn thời gian (product listing, user profile...) hoặc cache HTML fragment, API response.

## Pattern: Cache-aside

1. App nhận request → kiểm tra Redis trước.
2. Nếu có (cache hit) → trả về ngay.
3. Nếu không có (cache miss) → đọc từ DB → lưu vào Redis (kèm TTL) → trả về.

## Ví dụ lệnh

```
GET product:123
SET product:123 "{...json...}" EX 300
```

- `EX 300`: TTL 5 phút, tránh cache tồn tại vĩnh viễn và dữ liệu cũ (stale).
- Khi dữ liệu gốc thay đổi, cần invalidate cache tương ứng (`DEL product:123`) hoặc set TTL ngắn.

## Lưu ý

- Chọn TTL phù hợp với tần suất thay đổi dữ liệu.
- Cẩn thận **cache stampede**: nhiều request cùng lúc miss cache → dồn tải DB. Có thể dùng lock hoặc random jitter cho TTL.
- Với dữ liệu lớn, cân nhắc nén (gzip) trước khi lưu.

## Giải pháp thay thế Redis

| Giải pháp | Ưu điểm | Nhược điểm | Khi nào nên dùng |
|---|---|---|---|
| **Memcached** | Đơn giản, rất nhanh, multi-threaded (tận dụng nhiều core tốt hơn Redis) | Chỉ có kiểu dữ liệu string đơn giản, không có persistence, không có cấu trúc dữ liệu phong phú | Chỉ cần cache key-value thuần túy, không cần tính năng khác của Redis (pub/sub, sorted set...) |
| **In-process/local cache** (Caffeine (Java), `node-cache`, `functools.lru_cache` (Python)) | Không tốn round-trip mạng, nhanh nhất có thể | Không dùng chung được giữa nhiều instance, mỗi server có cache riêng → dễ inconsistent, mất khi restart | App chạy 1 instance, hoặc cache dữ liệu ít thay đổi và chấp nhận mỗi instance cache riêng |
| **HTTP/CDN cache** (Varnish, Cloudflare, Nginx proxy_cache) | Cache ở tầng gần user nhất, giảm tải toàn bộ backend, tốt cho static/API GET response | Khó invalidate chính xác theo từng bản ghi, chủ yếu phù hợp response công khai (không cá nhân hóa) | Cache toàn trang, API GET công khai, asset tĩnh |
| **DB query cache / materialized view** | Không cần thêm hạ tầng, dữ liệu luôn nhất quán với DB | Chậm hơn Redis, refresh materialized view tốn tài nguyên | Query phức tạp, dữ liệu ít thay đổi (báo cáo, dashboard), muốn tránh thêm thành phần hệ thống |

**Khi nào chọn Redis**: cần cache dùng chung giữa nhiều server, TTL linh hoạt theo key, hoặc cần thêm cấu trúc dữ liệu khác (hash, set...) ngoài string đơn giản.

## Ví dụ triển khai theo framework

API mẫu: đọc sản phẩm theo pattern cache-aside (GET), xoá cache khi dữ liệu thay đổi (DELETE).

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều dùng chung key `product:{id}`, TTL 300s, và cùng logic: kiểm tra cache trước, miss thì đọc "DB" rồi ghi lại cache.
