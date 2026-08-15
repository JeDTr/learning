# Distributed lock

Đảm bảo chỉ 1 process xử lý 1 tác vụ tại một thời điểm trong hệ thống nhiều instance (ví dụ: chỉ 1 worker được chạy cron job, tránh double booking).

## Ví dụ cơ bản

```
SET lock:order:123 "worker-1" NX EX 10
```

- `NX`: chỉ set nếu key chưa tồn tại → đảm bảo chỉ 1 process lấy được lock.
- `EX 10`: TTL 10s, tránh deadlock vĩnh viễn nếu process giữ lock bị crash.
- Khi xong việc, release lock bằng cách `DEL`, nhưng phải kiểm tra đúng chủ sở hữu (dùng Lua script để so sánh value trước khi xóa, tránh xóa nhầm lock của process khác).

## Redlock

- Thuật toán Redlock (dùng nhiều Redis instance độc lập) giúp lock đáng tin cậy hơn trong môi trường phân tán, tránh single point of failure.
- Lưu ý: Redlock có tranh cãi về tính đúng đắn tuyệt đối trong một số edge case (clock drift, GC pause) — với bài toán cần correctness tuyệt đối, cân nhắc dùng Zookeeper/etcd.

## Use case

- Cron job chỉ chạy trên 1 instance dù deploy nhiều bản.
- Tránh xử lý trùng 1 đơn hàng/thanh toán khi có nhiều worker.

## Giải pháp thay thế Redis

| Giải pháp | Ưu điểm | Nhược điểm | Khi nào nên dùng |
|---|---|---|---|
| **ZooKeeper** | Được thiết kế chuyên cho coordination/lock phân tán, tính đúng đắn cao (consensus qua ZAB protocol) | Vận hành phức tạp, nặng so với nhu cầu chỉ cần lock đơn giản | Hệ thống lớn (thường đã dùng Kafka/Hadoop nên có sẵn ZooKeeper), cần lock cực kỳ tin cậy |
| **etcd** | Consensus qua Raft, đúng đắn cao, đơn giản hơn ZooKeeper, phổ biến trong hệ sinh thái Kubernetes | Vẫn cần vận hành thêm 1 cluster riêng | Hệ thống chạy trên Kubernetes (thường có sẵn etcd), cần lock/leader election tin cậy |
| **DB advisory lock** (Postgres `pg_advisory_lock`) | Không cần thêm hạ tầng, transaction cùng DB nghiệp vụ | Gắn chặt với 1 kết nối DB, không phù hợp lock giữ lâu, tăng tải DB chính | Hệ thống nhỏ, đã dùng Postgres, cần lock đơn giản trong 1 transaction |
| **Consul** | Có sẵn service discovery + lock, tích hợp tốt cho microservice | Cần thêm thành phần hạ tầng nếu chưa dùng Consul cho việc khác | Hệ thống đã dùng Consul cho service discovery |

**Khi nào chọn Redis**: cần lock tốc độ cao, TTL ngắn, hệ thống không yêu cầu correctness tuyệt đối kiểu tài chính (nếu cần correctness tuyệt đối, ưu tiên ZooKeeper/etcd hơn Redlock).

## Ví dụ triển khai theo framework

API mẫu: acquire lock bằng `SET NX EX` trước khi xử lý đơn hàng, release lock bằng Lua script (chỉ xoá nếu đúng chủ sở hữu).

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều dùng key `lock:order:{orderId}`, TTL 10s, value là 1 token ngẫu nhiên (UUID) để đảm bảo chỉ chính process đã acquire mới release được lock.
