# Replication (Master-Replica)

Nhân bản dữ liệu từ 1 node chính (master) sang 1 hoặc nhiều node phụ (replica), phục vụ đọc mở rộng và làm nền tảng cho high availability.

## Thiết lập

```bash
# Trên replica — trỏ về master
redis-cli REPLICAOF 192.168.1.10 6379

# Hoặc trong redis.conf của replica:
# replicaof 192.168.1.10 6379

# Huỷ làm replica, trở lại làm master độc lập:
redis-cli REPLICAOF NO ONE
```

```bash
redis-cli INFO replication    # xem trạng thái: role, connected_slaves, master_repl_offset...
```

## Cơ chế hoạt động

1. Replica kết nối tới master, gửi `PSYNC`.
2. **Full resync** (lần đầu hoặc khi lệch quá nhiều): master `BGSAVE` toàn bộ dữ liệu, gửi file RDB cho replica, sau đó stream tiếp các lệnh ghi mới.
3. **Partial resync** (khi mất kết nối tạm thời): nếu offset còn nằm trong `repl-backlog` (buffer lệnh gần đây trên master), replica chỉ cần đồng bộ phần bị thiếu, không cần full resync lại — nhanh hơn nhiều.
4. Sau đồng bộ ban đầu, mọi lệnh ghi trên master được **stream bất đồng bộ (async)** xuống replica.

## Read scaling

```conf
replica-read-only yes   # (mặc định) chặn ghi trực tiếp lên replica, tránh dữ liệu phân kỳ
```

- App có thể route các lệnh `GET`/đọc sang replica để giảm tải cho master, còn ghi (`SET`, `INCR`...) luôn qua master.

## Đảm bảo độ trễ đồng bộ (nếu cần)

```
WAIT numreplicas timeout
```

- Block cho đến khi có `numreplicas` replica xác nhận đã nhận lệnh ghi gần nhất, hoặc hết `timeout` (ms). Dùng khi cần đảm bảo dữ liệu đã lan ra ít nhất N replica trước khi coi là "ghi thành công" (giảm rủi ro mất dữ liệu nếu master chết ngay sau đó).

## Lưu ý quan trọng

- Replication là **bất đồng bộ (async)** theo mặc định → có độ trễ replication lag, replica có thể trả về dữ liệu cũ hơn master vài mili-giây (hoặc lâu hơn nếu mạng chậm/replica quá tải).
- Replication **không tự động failover** — nếu master chết, replica không tự trở thành master; cần Sentinel hoặc Cluster để tự động hoá (xem [advanced/05-high-availability](../05-high-availability/README.md)).
- Không nên coi replica là "backup" — nếu lệnh `FLUSHALL` chạy nhầm trên master, nó sẽ replicate luôn xuống replica.

## Ví dụ triển khai theo framework

API mẫu: tách 2 client riêng biệt — ghi (`INCR`) qua master, đọc (`GET`) qua replica (read/write splitting).

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều dùng 2 connection cấu hình host khác nhau (`master.redis.internal` / `replica.redis.internal`). Lưu ý: `GET` qua replica có thể trả dữ liệu cũ hơn vài mili-giây do replication lag — chỉ phù hợp khi app chấp nhận eventual consistency ở đường đọc.
