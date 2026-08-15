# Backup & Recovery

Đảm bảo có thể khôi phục dữ liệu Redis khi mất server, hỏng đĩa, hoặc thao tác nhầm (ví dụ `FLUSHALL` nhầm ở production).

## Backup

### Cách 1: Backup file RDB (đơn giản, phổ biến nhất)

```bash
redis-cli BGSAVE                 # kích hoạt snapshot chạy nền, không block server
redis-cli LASTSAVE                # kiểm tra timestamp lần save gần nhất, để biết BGSAVE đã xong chưa

# sau khi BGSAVE hoàn tất, copy file dump.rdb (đường dẫn theo config 'dir')
cp /var/lib/redis/dump.rdb /backup/redis/dump-$(date +%Y%m%d-%H%M%S).rdb
```

- Nên chạy `BGSAVE` (không phải `SAVE` — lệnh này block toàn bộ server cho tới khi ghi xong).
- Tự động hoá bằng cron chạy script trên, hoặc snapshot ở tầng hạ tầng (EBS snapshot, LVM snapshot) nếu không muốn ảnh hưởng CPU/IO của Redis.

### Cách 2: Backup file AOF (nếu bật persistence AOF)

```bash
redis-cli BGREWRITEAOF            # nén AOF trước khi backup cho gọn
cp /var/lib/redis/appendonly.aof /backup/redis/
```

### Cách 3: Managed backup (cloud)

- AWS ElastiCache, Redis Enterprise Cloud... có tính năng automated snapshot theo lịch, retention policy sẵn — nên ưu tiên nếu đang chạy trên cloud thay vì tự quản lý.

## Recovery (Restore)

```bash
# 1. Dừng Redis
systemctl stop redis

# 2. Copy file backup vào đúng thư mục 'dir' đã cấu hình, đúng tên file (dump.rdb hoặc appendonly.aof)
cp /backup/redis/dump-20260810-0200.rdb /var/lib/redis/dump.rdb

# 3. Khởi động lại — Redis tự động load file khi start
systemctl start redis

# 4. Kiểm tra
redis-cli DBSIZE
```

- Nếu bật cả RDB và AOF, khi khởi động Redis **ưu tiên load AOF** (dữ liệu mới hơn), trừ khi chỉ backup/restore riêng RDB.

## Lưu ý quan trọng

- **Test restore định kỳ** — backup không có giá trị nếu chưa từng thử restore thành công; nhiều sự cố thực tế phát hiện file backup bị hỏng/thiếu chỉ khi cần dùng thật.
- **Point-in-time**: RDB chỉ khôi phục đến thời điểm snapshot gần nhất; AOF (`everysec`) khôi phục gần với thời điểm crash hơn.
- Backup nên lưu **ở nơi khác** với server Redis (S3, server khác) — backup cùng ổ đĩa với server gốc không có tác dụng nếu ổ đĩa hỏng.
- Với dữ liệu chỉ là cache (tái tạo được từ DB chính) — có thể không cần backup Redis, chỉ cần đảm bảo app tự nạp lại cache khi restart.

## Ví dụ triển khai theo framework

API mẫu (admin-only): kích hoạt backup an toàn (từ chối nếu đã có `BGSAVE` khác đang chạy), kiểm tra thời điểm backup gần nhất để cảnh báo khi bị trễ.

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều expose `POST /admin/backup/trigger` (bọc `BGSAVE`, kiểm tra `rdb_bgsave_in_progress` trước khi chạy) và `GET /admin/backup/last` (dùng `LASTSAVE` để tính độ trễ, đánh dấu `stale` nếu quá 24h — phù hợp gắn vào alert/monitoring).
