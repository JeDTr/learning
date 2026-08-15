# Redis Configuration (redis.conf)

Cấu hình hành vi của Redis server: network, persistence, memory, security...

## Nạp config

```bash
redis-server /etc/redis/redis.conf
```

- Nếu không truyền file, Redis chạy với default config (không nên dùng ở production).

## Các directive quan trọng

```conf
bind 127.0.0.1 -::1        # địa chỉ cho phép kết nối, KHÔNG nên để 0.0.0.0 nếu không có firewall
protected-mode yes         # từ chối kết nối ngoài nếu chưa set requirepass
port 6379
requirepass "your_strong_password"

daemonize no
pidfile /var/run/redis.pid
logfile /var/log/redis/redis.log
dir /var/lib/redis          # nơi lưu dump.rdb / appendonly.aof

maxmemory 2gb
maxmemory-policy allkeys-lru   # xem thêm ở advanced/08-memory-eviction

save 900 1                  # RDB snapshot: 900s nếu có >=1 key thay đổi
save 300 10
appendonly yes              # bật AOF, xem thêm ở advanced/02-persistence

timeout 0                   # đóng kết nối idle sau N giây (0 = không giới hạn)
tcp-keepalive 300
databases 16                # số DB đánh số (SELECT 0..15), namespace đơn giản không cách ly thật sự
```

## Xem/sửa config lúc runtime

```
CONFIG GET maxmemory
CONFIG SET maxmemory 4gb
CONFIG REWRITE          # ghi thay đổi runtime xuống lại file redis.conf (nếu không, mất khi restart)
```

- Không phải mọi directive đều set được lúc runtime (ví dụ `port`, `bind` cần sửa file + restart).
- `CONFIG SET` áp dụng ngay nhưng **không tự lưu vào file** — phải gọi thêm `CONFIG REWRITE` để giữ sau khi restart.

## Lưu ý

- Không bao giờ để Redis mở port 6379 ra internet mà không có `requirepass`/ACL và firewall — Redis mặc định không mã hoá, dễ bị quét và khai thác (ví dụ dùng để chèn cron job độc hại qua `CONFIG SET dir` + `SAVE`).
- Đổi tên hoặc tắt các lệnh nguy hiểm trong production: xem [advanced/07-security](../07-security/README.md).

## Ví dụ triển khai theo framework

API mẫu (admin-only, nên bọc thêm auth riêng): kết nối kèm password/timeout, đọc/sửa config lúc runtime, rewrite xuống file.

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều minh hoạ: client kết nối có `password`/timeout tường minh, endpoint `GET/PUT /admin/config/{key}` bọc `CONFIG GET`/`CONFIG SET`, và endpoint `POST /admin/config/rewrite` bọc `CONFIG REWRITE`.
