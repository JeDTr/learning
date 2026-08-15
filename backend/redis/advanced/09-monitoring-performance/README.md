# Monitoring & Performance Tuning

Theo dõi sức khoẻ Redis và phát hiện nghẽn hiệu năng trước khi ảnh hưởng người dùng.

## `INFO` — nguồn thông tin chính

```bash
redis-cli INFO                  # toàn bộ
redis-cli INFO memory
redis-cli INFO stats
redis-cli INFO replication
redis-cli INFO keyspace
```

Các chỉ số quan trọng cần theo dõi:

| Chỉ số (trong section) | Ý nghĩa |
|---|---|
| `used_memory` / `maxmemory` | % bộ nhớ đã dùng — cảnh báo trước khi chạm eviction/OOM |
| `connected_clients` | Số kết nối hiện tại — tăng bất thường có thể là leak connection ở app |
| `instantaneous_ops_per_sec` | Số lệnh/giây hiện tại — theo dõi để biết traffic pattern |
| `keyspace_hits` / `keyspace_misses` | Tỷ lệ cache hit — hit thấp bất thường nghĩa là cache không hiệu quả (TTL sai, key pattern sai) |
| `evicted_keys` | Số key bị xoá do đầy bộ nhớ — tăng liên tục nghĩa là `maxmemory` đang nhỏ hơn nhu cầu thực |
| `rejected_connections` | Kết nối bị từ chối do vượt `maxclients` |
| `master_repl_offset` / `slave_repl_offset` | Chênh lệch giữa 2 giá trị này ở replica cho biết replication lag |

## `SLOWLOG` — lệnh chạy chậm

```conf
slowlog-log-slower-than 10000   # log lệnh chạy chậm hơn 10ms (đơn vị: micro giây)
slowlog-max-len 128
```

```bash
redis-cli SLOWLOG GET 10        # xem 10 lệnh chậm gần nhất
redis-cli SLOWLOG RESET
```

- Lệnh chậm thường là dấu hiệu dùng lệnh có độ phức tạp cao trên dataset lớn (`KEYS *`, `SMEMBERS` trên set khổng lồ, `SORT` không giới hạn...).

## `LATENCY` — độ trễ hệ thống

```bash
redis-cli LATENCY HISTORY event-loop-cycle
redis-cli LATENCY LATEST
```

- Phát hiện các "latency spike" và nguyên nhân (fork chậm khi BGSAVE, swap, lệnh block lâu...).

## Công cụ dòng lệnh hữu ích khác

```bash
redis-cli --stat                # xem realtime: ops/sec, connected clients, memory... theo từng giây
redis-cli --bigkeys             # quét tìm key lớn bất thường theo từng kiểu dữ liệu
redis-cli --latency              # đo round-trip latency liên tục tới server
redis-benchmark -q -n 100000     # load test với 100k request
```

## Giám sát dài hạn (production)

- **RedisInsight** (GUI chính thức): xem realtime dashboard, browse key, phân tích slowlog.
- **redis_exporter** + Prometheus + Grafana: theo dõi lịch sử, đặt alert (ví dụ: `used_memory/maxmemory > 90%`, `evicted_keys` tăng liên tục, `keyspace_hit_rate` giảm đột ngột).
- Nên đặt alert cho: memory gần đầy, replication lag cao, số connection gần chạm `maxclients`, tỷ lệ cache hit giảm bất thường.

## Vài nguyên tắc tuning nhanh

- Tránh `KEYS *`/`SMEMBERS` trên collection lớn ở production — dùng `SCAN`/`SSCAN`/`HSCAN` (duyệt theo cursor, không block).
- Pipeline nhiều lệnh liên tiếp thay vì gọi round-trip riêng lẻ khi có thể (giảm network overhead).
- Theo dõi `mem_fragmentation_ratio` — nếu cao, cân nhắc `activedefrag yes`.
- Nếu 1 lệnh đơn lẻ (ví dụ Lua script phức tạp) chạy lâu, toàn bộ server bị block do Redis single-threaded — luôn giữ mỗi lệnh/script đủ nhanh.

## Ví dụ triển khai theo framework

API mẫu: health-check nhẹ cho load balancer (`PING`), endpoint metrics chi tiết cho dashboard nội bộ (`INFO stats/memory/clients`), và endpoint xem slowlog.

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều expose `GET /health/redis` (chỉ `PING`, trả 200/503 cho load balancer), `GET /admin/metrics/redis` (tính `hit_rate_pct` từ `keyspace_hits`/`keyspace_misses`, phù hợp đẩy sang Prometheus/Grafana), và `GET /admin/slowlog` (bọc `SLOWLOG GET`).
