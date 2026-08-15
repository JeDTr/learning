# Persistence — RDB vs AOF

Redis là in-memory store, nhưng có 2 cơ chế để dữ liệu sống sót qua restart/crash.

## RDB (Redis Database — snapshot)

```conf
save 900 1     # snapshot nếu có >=1 key thay đổi trong 900s
save 300 10    # snapshot nếu có >=10 key thay đổi trong 300s
save 60 10000
```

- Định kỳ dump toàn bộ dữ liệu ra 1 file nhị phân (`dump.rdb`).
- `BGSAVE`: fork process con để ghi file, không block server chính (dùng copy-on-write của OS).
- **Ưu điểm**: file nhỏ gọn, restore nhanh, phù hợp backup/disaster recovery.
- **Nhược điểm**: mất dữ liệu giữa 2 lần snapshot nếu crash (ví dụ snapshot mỗi 5 phút → có thể mất tới 5 phút dữ liệu).

## AOF (Append Only File)

```conf
appendonly yes
appendfsync everysec   # always | everysec | no
```

- Ghi lại **mọi lệnh write** vào file log, replay lại khi khởi động để khôi phục trạng thái.
- `appendfsync`:
  - `always`: fsync sau mỗi lệnh — an toàn nhất, chậm nhất.
  - `everysec` (khuyến nghị): fsync mỗi giây — cân bằng, mất tối đa ~1s dữ liệu nếu crash.
  - `no`: để OS quyết định khi nào flush — nhanh nhất, rủi ro mất dữ liệu cao nhất.
- File AOF phình to theo thời gian → cần `BGREWRITEAOF` để nén lại (Redis tự động rewrite khi file vượt ngưỡng `auto-aof-rewrite-percentage`).

## Hybrid (khuyến nghị cho production)

```conf
appendonly yes
aof-use-rdb-preamble yes   # (mặc định từ Redis 4+) AOF rewrite dùng định dạng RDB làm phần đầu, rồi mới ghi tiếp lệnh mới
```

- Kết hợp: khởi động nhanh như RDB, ít mất dữ liệu như AOF.

## So sánh

| Tiêu chí | RDB | AOF |
|---|---|---|
| Độ mất dữ liệu khi crash | Cao hơn (khoảng cách giữa 2 snapshot) | Thấp hơn (tối đa ~1s với `everysec`) |
| Tốc độ khởi động lại | Nhanh | Chậm hơn (phải replay log) |
| Kích thước file | Nhỏ gọn | Lớn hơn (dù có rewrite/nén) |
| Hiệu năng khi ghi | Không ảnh hưởng đến traffic bình thường (fork) | Có overhead ghi log liên tục |
| Phù hợp | Backup định kỳ, disaster recovery | Cần độ bền dữ liệu cao |

## Khi nào cần quan tâm

- Nếu Redis chỉ dùng làm **cache** (dữ liệu tái tạo được từ nguồn khác) → có thể tắt hẳn persistence hoặc chỉ dùng RDB nhẹ, ưu tiên hiệu năng.
- Nếu Redis dùng cho **dữ liệu quan trọng hơn** (session, queue chưa xử lý) → nên bật cả RDB (backup định kỳ) và AOF (`everysec`) để giảm rủi ro mất dữ liệu.

## Ví dụ triển khai theo framework

API mẫu (admin-only): xem trạng thái persistence hiện tại (`INFO persistence`), chủ động kích hoạt `BGSAVE`/`BGREWRITEAOF`.

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều expose `GET /admin/persistence/status` (đọc `rdb_last_save_time`, `aof_enabled`...) và 2 endpoint kích hoạt snapshot/rewrite thủ công — hữu ích để hiển thị lên dashboard nội bộ hoặc gọi từ script vận hành.
