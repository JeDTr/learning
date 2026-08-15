# High Availability — Redis Sentinel

[Replication](../04-replication/README.md) tự nó không tự động xử lý khi master chết. Sentinel giải quyết bài toán: giám sát master/replica và tự động failover.

## Sentinel làm gì

1. **Giám sát (monitoring)**: liên tục ping master + replica, phát hiện node nào không phản hồi.
2. **Thông báo (notification)**: báo qua API/script khi có sự cố.
3. **Failover tự động**: khi master bị coi là down, Sentinel bầu 1 replica lên làm master mới, cấu hình lại các replica còn lại trỏ về master mới.
4. **Cung cấp service discovery**: client hỏi Sentinel "master hiện tại là node nào" thay vì hardcode địa chỉ master.

## Cấu hình cơ bản (sentinel.conf)

```conf
sentinel monitor mymaster 192.168.1.10 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1
```

- `mymaster`: tên định danh cho cụm được giám sát.
- `2`: **quorum** — số lượng Sentinel tối thiểu phải đồng ý "master đã down" trước khi kích hoạt failover (tránh 1 Sentinel bị lỗi mạng cục bộ tự ý failover nhầm).
- Nên chạy **ít nhất 3 Sentinel** trên các host khác nhau để có quorum đáng tin cậy (số lẻ, tránh chia phiếu 50/50).

## Chạy Sentinel

```bash
redis-sentinel /etc/redis/sentinel.conf
# hoặc: redis-server /etc/redis/sentinel.conf --sentinel
```

```bash
redis-cli -p 26379 SENTINEL masters
redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster
```

## Client cần "Sentinel-aware"

- App không kết nối thẳng vào IP master cố định — client library (redis.asyncio, ioredis, predis đều hỗ trợ) hỏi Sentinel để lấy địa chỉ master hiện tại, và tự động reconnect khi Sentinel báo master đã đổi.
- Nếu dùng client thường (không qua Sentinel), app sẽ mất kết nối khi failover xảy ra vì vẫn trỏ vào master cũ đã chết.

## Khi nào cần Sentinel

- Cần **tự động failover** mà không cần con người can thiệp khi master chết (giảm downtime).
- Hệ thống chưa đủ lớn để cần sharding (dữ liệu vẫn fit trong 1 node) — nếu cần cả sharding lẫn HA, nên dùng [Redis Cluster](../06-clustering/README.md) (đã tích hợp cơ chế failover riêng, không cần Sentinel).

## Lưu ý

- Failover có "downtime ngắn" trong lúc bầu master mới (vài giây) — không phải zero-downtime tuyệt đối.
- Dữ liệu ghi vào master ngay trước khi chết có thể mất nếu chưa kịp replicate xuống replica (do replication async) — cân nhắc `WAIT` nếu cần giảm rủi ro này ở nghiệp vụ quan trọng.

## Ví dụ triển khai theo framework

API mẫu: kết nối qua Sentinel-aware client thay vì hardcode IP master, tự động dùng đúng master hiện tại kể cả sau khi failover.

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio.sentinel.Sentinel`)
- [PHP — Laravel](examples/laravel_example.php) (`Predis\Client` với `'replication' => 'sentinel'`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis` với option `sentinels`)

Cả 3 đều khai báo danh sách Sentinel node (không phải địa chỉ Redis trực tiếp) + tên monitor `mymaster`. Client tự hỏi Sentinel để biết master hiện tại, và tự reconnect khi Sentinel báo có failover.
