# Redis — Use Cases & Kiến thức nâng cao

Redis là một loại NoSQL dạng **in-memory key-value store**, không phải đối lập với NoSQL. So với các NoSQL khác (MongoDB, Cassandra...), Redis đánh đổi độ bền dữ liệu để lấy tốc độ cực nhanh.

## Redis vs NoSQL khác

| Tiêu chí | Redis | NoSQL khác (Mongo/Cassandra...) |
|---|---|---|
| Vai trò | Cache / tốc độ | Primary storage |
| Tốc độ | Rất nhanh (RAM) | Nhanh (disk, có index) |
| Độ bền dữ liệu | Yếu hơn | Mạnh, thiết kế cho lâu dài |
| Dung lượng | Giới hạn bởi RAM | Scale lớn trên disk |
| Query phức tạp | Hạn chế | Tốt hơn (aggregation, index) |

Trong thực tế, hai loại này thường **dùng chung**: Redis làm cache/session phía trước, DB khác (Postgres/Mongo/Cassandra) làm nguồn dữ liệu chính phía sau.

## Khi nào nên dùng Redis

Dùng khi cần **tốc độ cực nhanh**, dữ liệu **nhỏ/vừa**, và chấp nhận được rủi ro mất dữ liệu nếu crash (hoặc có thể tái tạo từ nguồn khác). Không nên dùng làm nguồn dữ liệu chính duy nhất (single source of truth) cho dữ liệu quan trọng lâu dài.

## [use-cases/](use-cases/) — Các bài toán thực tế

Mỗi bài toán có ví dụ triển khai kèm code FastAPI/Laravel/NestJS, và bảng so sánh với các giải pháp thay thế Redis.

1. [Cache](use-cases/01-cache/README.md)
2. [Session store](use-cases/02-session-store/README.md)
3. [Rate limiting / Throttling](use-cases/03-rate-limiting/README.md)
4. [Leaderboard / Ranking](use-cases/04-leaderboard/README.md)
5. [Queue / Job xử lý nền](use-cases/05-queue-job/README.md)
6. [Pub/Sub — real-time messaging](use-cases/06-pubsub/README.md)
7. [Distributed lock](use-cases/07-distributed-lock/README.md)
8. [Đếm số liệu real-time](use-cases/08-realtime-counter/README.md)
9. [Geo-location](use-cases/09-geolocation/README.md)
10. [Feature flag / Config động](use-cases/10-feature-flag/README.md)

## [advanced/](advanced/) — Kiến thức vận hành nâng cao

Cách cấu hình, vận hành, và đảm bảo độ tin cậy cho một Redis instance/cluster trong production.

1. [Configuration (redis.conf)](advanced/01-configuration/README.md)
2. [Persistence — RDB vs AOF](advanced/02-persistence/README.md)
3. [Backup & Recovery](advanced/03-backup-recovery/README.md)
4. [Replication (Master-Replica)](advanced/04-replication/README.md)
5. [High Availability — Sentinel](advanced/05-high-availability/README.md)
6. [Clustering — Sharding](advanced/06-clustering/README.md)
7. [Security — Auth, ACL, TLS](advanced/07-security/README.md)
8. [Memory Management & Eviction](advanced/08-memory-eviction/README.md)
9. [Monitoring & Performance Tuning](advanced/09-monitoring-performance/README.md)
10. [Transactions & Lua Scripting](advanced/10-transactions-scripting/README.md)

## Khi KHÔNG nên dùng Redis

- Dữ liệu cần **quan hệ phức tạp**, join nhiều bảng → dùng RDBMS.
- Dữ liệu lớn hơn RAM đáng kể và cần lưu trữ lâu dài, đầy đủ ACID → dùng Postgres/MongoDB.
- Cần audit trail, không được mất dữ liệu tuyệt đối → không nên coi Redis là nguồn chính (dù AOF/RDB có persistence, không mạnh bằng DB truyền thống).
