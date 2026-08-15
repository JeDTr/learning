# Redis Cluster

Sharding dữ liệu ngang qua nhiều node khi dữ liệu/traffic vượt quá khả năng 1 node xử lý — [replication](../04-replication/README.md) và [Sentinel](../05-high-availability/README.md) chỉ nhân bản, không chia nhỏ dữ liệu.

## Cơ chế hash slot

- Toàn bộ keyspace được chia thành **16384 hash slot** cố định.
- Mỗi key được gán vào 1 slot bằng `CRC16(key) % 16384`.
- Mỗi node trong cluster chịu trách nhiệm 1 dải slot (ví dụ node A: slot 0-5460, node B: 5461-10922, node C: 10923-16383).
- Mỗi shard (dải slot) thường có thêm 1+ replica để vẫn có HA trong cluster (cluster tự failover nội bộ khi 1 master-shard chết, không cần Sentinel riêng).

## Khởi tạo cluster (ví dụ 3 master + 3 replica)

```bash
redis-cli --cluster create \
  127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
  127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \
  --cluster-replicas 1
```

```bash
redis-cli -c -p 7000 CLUSTER NODES     # xem danh sách node + dải slot mỗi node phụ trách
redis-cli -c -p 7000 CLUSTER INFO
```

- Cờ `-c` (cluster mode) cho `redis-cli`: tự động redirect (`MOVED`) khi lệnh gõ vào sai node phụ trách slot của key đó.

## Hash tag — gom nhiều key vào cùng 1 slot

```
SET user:{1000}:profile "..."
SET user:{1000}:settings "..."
```

- Phần trong `{}` mới được dùng để tính hash slot → 2 key trên chắc chắn nằm cùng 1 node.
- Cần thiết khi muốn dùng lệnh multi-key (`MGET`, transaction `MULTI/EXEC`, Lua script) trên các key liên quan — Redis Cluster **từ chối** lệnh multi-key nếu các key nằm khác slot.

## Giới hạn cần biết

- Lệnh multi-key (`MGET key1 key2`, `SUNIONSTORE`...) chỉ hoạt động nếu tất cả key cùng slot → phải thiết kế key với hash tag ngay từ đầu nếu biết sẽ cần thao tác nhóm.
- Transaction (`MULTI/EXEC`) và Lua script cũng bị giới hạn tương tự — chỉ atomic trong phạm vi 1 node/slot.
- Client phải hỗ trợ cluster mode (biết cách theo dõi bảng slot, xử lý `MOVED`/`ASK` redirect) — hầu hết client hiện đại (redis.asyncio, ioredis, predis) đều có cluster client riêng.

## Khi nào cần Redis Cluster

- Dữ liệu vượt quá RAM của 1 node đơn (ví dụ cần hàng trăm GB) — cluster cho phép scale ngang.
- Throughput ghi/đọc vượt quá khả năng xử lý của 1 node.
- Nếu dữ liệu vẫn fit thoải mái trong 1 node và chỉ cần HA (không cần sharding) → dùng Sentinel đơn giản hơn nhiều, không vướng giới hạn multi-key.

## Ví dụ triển khai theo framework

API mẫu: kết nối qua cluster-aware client, dùng **hash tag** để đảm bảo các key liên quan tới cùng 1 user nằm chung 1 slot (cho phép `MGET` nhiều key cùng lúc).

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio.cluster.RedisCluster`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, connection `cluster` với option `'cluster' => 'redis'`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis` với `Cluster`)

Cả 3 đều dùng key dạng `user:{userId}:profile` / `user:{userId}:settings` — phần trong `{}` mới được dùng để tính hash slot, đảm bảo `MGET` cả 2 key không bị lỗi "CROSSSLOT".
