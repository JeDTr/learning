# Memory Management & Eviction Policies

Redis lưu dữ liệu trong RAM — cần chủ động quản lý khi bộ nhớ đầy, nếu không server có thể bị OOM-killed bởi hệ điều hành.

## Giới hạn bộ nhớ

```conf
maxmemory 2gb
maxmemory-policy allkeys-lru
```

- `maxmemory`: giới hạn cứng, khi đạt tới sẽ áp dụng `maxmemory-policy` để giải phóng chỗ trống.
- Không set `maxmemory` (mặc định = 0, không giới hạn) → Redis có thể chiếm hết RAM server, dễ gây OOM ở tầng OS (nguy hiểm hơn nhiều so với việc Redis tự evict key).

## Các eviction policy

| Policy | Ý nghĩa |
|---|---|
| `noeviction` (mặc định) | Không xoá gì cả — lệnh ghi mới sẽ **lỗi** khi đầy bộ nhớ. An toàn dữ liệu nhất, nhưng app cần xử lý lỗi ghi. |
| `allkeys-lru` | Xoá key **ít được truy cập gần đây nhất** (Least Recently Used) trong toàn bộ keyspace. |
| `volatile-lru` | Giống trên nhưng **chỉ áp dụng cho key có set TTL** — key không có TTL không bao giờ bị động tới. |
| `allkeys-lfu` | Xoá key **ít được truy cập nhất về tần suất** (Least Frequently Used) — tốt hơn LRU khi có key truy cập đều đặn nhưng không liên tục. |
| `volatile-lfu` | LFU nhưng chỉ trên key có TTL. |
| `allkeys-random` | Xoá ngẫu nhiên bất kỳ key nào. |
| `volatile-random` | Xoá ngẫu nhiên trong các key có TTL. |
| `volatile-ttl` | Ưu tiên xoá key có TTL **gần hết hạn nhất** trước. |

## Chọn policy nào

- **Redis dùng thuần làm cache** (mọi key nên có TTL, tái tạo được từ DB) → `allkeys-lru` hoặc `allkeys-lfu` (LFU tốt hơn nếu pattern truy cập có key "nóng" ổn định, LRU đơn giản và đủ dùng cho phần lớn trường hợp).
- **Redis chứa cả dữ liệu quan trọng không có TTL** (session, config, lock) trộn lẫn với cache có TTL → dùng `volatile-lru`/`volatile-lfu` để đảm bảo chỉ xoá phần cache, không đụng vào dữ liệu quan trọng.
- **Không chấp nhận mất dữ liệu bất kỳ key nào** (Redis dùng như queue/nguồn dữ liệu chính) → giữ `noeviction`, nhưng phải theo dõi memory sát sao và có cảnh báo trước khi đầy, vì app sẽ nhận lỗi `OOM command not allowed` khi ghi.

## Theo dõi bộ nhớ

```
INFO memory                 # used_memory, used_memory_peak, mem_fragmentation_ratio...
MEMORY USAGE mykey           # dung lượng của 1 key cụ thể
MEMORY DOCTOR                 # gợi ý chẩn đoán nhanh nếu có vấn đề bất thường
redis-cli --bigkeys           # quét tìm các key lớn bất thường (nên chạy giờ thấp điểm, tốn CPU)
```

## Lưu ý

- `mem_fragmentation_ratio` quá cao (>1.5) thường do pattern cấp phát/giải phóng bộ nhớ liên tục — cân nhắc `MEMORY PURGE` hoặc bật `activedefrag yes`.
- Set TTL hợp lý cho mọi key cache (xem [use-cases/01-cache](../../use-cases/01-cache/README.md)) là cách chủ động nhất để tránh phụ thuộc hoàn toàn vào eviction.

## Ví dụ triển khai theo framework

API mẫu (admin-only): xem % bộ nhớ đã dùng + policy hiện tại, kiểm tra dung lượng 1 key cụ thể, đổi eviction policy lúc runtime.

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều expose `GET /admin/memory/status` (parse `INFO memory` + `INFO stats` để tính `usage_pct`, đọc `evicted_keys`), `GET /admin/memory/key/{key}` (bọc `MEMORY USAGE`), và `PUT /admin/memory/policy` (bọc `CONFIG SET maxmemory-policy`).
