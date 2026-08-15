# Queue / Job xử lý nền

Hàng đợi task đơn giản, thường thấy trong hệ thống gửi email, xử lý ảnh, notification.

## Pattern đơn giản: List

```
LPUSH queue:emails "{\"to\":\"a@b.com\",\"template\":\"welcome\"}"
BRPOP queue:emails 0      # worker blocking-pop, xử lý theo FIFO
```

- `BRPOP` block cho đến khi có job mới, tránh polling liên tục tốn CPU.
- Đơn giản, dễ triển khai, nhưng không có retry/dead-letter-queue built-in — cần tự xây thêm ở tầng ứng dụng.

### Cơ chế thực sự phía sau

`LPUSH`/`BRPOP` chỉ là thao tác thuần túy trên List — **Redis không biết khái niệm "job"**. Toàn bộ ý nghĩa "hàng đợi" là do ứng dụng tự quy ước:

1. **Producer**: serialize job thành string (JSON) → `LPUSH` vào đầu list.
2. **Worker**: `BRPOP` block chờ, khi có dữ liệu thì lấy ra **và xoá luôn khỏi list trong 1 thao tác atomic**, rồi tự deserialize và chạy logic xử lý.
3. `LPUSH` (chèn đầu) + `BRPOP` (lấy cuối) → đảm bảo thứ tự FIFO.

**Điểm yếu**: vì `BRPOP` xoá job khỏi list ngay khi lấy ra (trước khi xử lý xong), nếu worker crash giữa chừng thì job **mất vĩnh viễn** — không có cơ chế nào biết để retry. List-based queue vì vậy chỉ phù hợp job "mất được" (best-effort).

## Pattern nâng cao: Redis Streams (có ack/retry)

```
XADD stream:emails * to a@b.com template welcome
XGROUP CREATE stream:emails email_workers 0 MKSTREAM
XREADGROUP GROUP email_workers worker-1 COUNT 1 BLOCK 5000 STREAMS stream:emails >
XACK stream:emails email_workers <message-id>
```

- `XADD` thêm job vào stream, mỗi job có 1 ID duy nhất do Redis tự sinh.
- `XREADGROUP` (đọc theo consumer group) khác `BRPOP` ở chỗ: khi worker đọc job bằng `>`, Redis **không xoá job khỏi stream** mà chỉ chuyển nó vào danh sách "pending" (PEL - Pending Entries List) gắn với consumer đó.
- Worker phải chủ động gọi `XACK` sau khi xử lý xong để Redis xoá job khỏi PEL. Nếu worker crash trước khi ack, job vẫn còn trong PEL.
- `XAUTOCLAIM`/`XCLAIM` dùng để "cướp lại" job bị treo quá lâu trong PEL (worker cũ chết) và giao cho worker khác xử lý tiếp — đây là cơ chế retry.
- Consumer group cũng đảm bảo nhiều worker chia nhau xử lý mà không trùng job (mỗi job chỉ được giao cho 1 consumer tại 1 thời điểm).
- Phù hợp hơn List khi cần độ tin cậy cao hơn, nhưng vẫn không mạnh bằng Kafka/RabbitMQ cho hệ thống lớn (không có cơ chế exchange/routing phức tạp, throughput thấp hơn Kafka).

## Khi nào nên chuyển sang Kafka/RabbitMQ

- Cần đảm bảo message không mất tuyệt đối, throughput rất lớn, hoặc cần routing/exchange phức tạp.

## Giải pháp thay thế Redis

| Giải pháp | Ưu điểm | Nhược điểm | Khi nào nên dùng |
|---|---|---|---|
| **RabbitMQ** | Đảm bảo delivery (ack/nack, dead-letter queue), routing linh hoạt (exchange/binding), đã ổn định lâu năm | Vận hành phức tạp hơn Redis, throughput thấp hơn Kafka | Job quan trọng cần đảm bảo không mất, cần routing phức tạp (fanout, topic, priority queue) |
| **Kafka** | Throughput cực cao, lưu trữ log lâu dài, replay được message, tốt cho event streaming | Nặng, phức tạp để vận hành (ZooKeeper/KRaft, partition, consumer group), overkill cho queue đơn giản | Hệ thống event-driven quy mô lớn, cần replay/audit log, nhiều consumer đọc cùng 1 stream |
| **AWS SQS / Google Cloud Tasks** (managed) | Không cần tự vận hành hạ tầng, tự động scale, có retry/dead-letter built-in | Tốn phí theo request, độ trễ cao hơn Redis, phụ thuộc cloud provider | Hệ thống đã chạy trên cloud, muốn giảm gánh nặng vận hành |
| **DB-based queue** (Postgres `SELECT ... FOR UPDATE SKIP LOCKED`) | Không cần thêm hạ tầng, transaction cùng với dữ liệu nghiệp vụ (atomic với business logic) | Throughput thấp hơn nhiều, DB không tối ưu cho polling liên tục | Job ít, tần suất thấp, muốn giữ đơn giản (chỉ 1 DB duy nhất) |

**Khi nào chọn Redis**: job đơn giản, không cần đảm bảo delivery tuyệt đối, ưu tiên tốc độ và dễ triển khai, hệ thống đã có sẵn Redis cho việc khác.

## Ví dụ triển khai theo framework

API mẫu: enqueue job gửi email (`LPUSH`) + worker riêng biệt xử lý job (`BRPOP` blocking).

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều dùng chung key List `queue:emails`, endpoint HTTP chỉ enqueue job, việc xử lý thật diễn ra ở worker process riêng (tách khỏi HTTP request).

### Bản đáng tin cậy hơn: Redis Streams + Consumer Group

API mẫu tương tự nhưng dùng `XADD`/`XREADGROUP`/`XACK`/`XAUTOCLAIM` — có ack và tự động "cướp lại" job bị treo khi worker crash.

- [Python — FastAPI](examples/fastapi_streams_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_streams_example.php) (`Illuminate\Support\Facades\Redis::executeRaw`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_streams_example.ts) (`ioredis`, gọi qua `redis.call(...)`)

Cả 3 đều dùng stream `stream:emails`, consumer group `email_workers`. Worker chỉ `XACK` sau khi xử lý job thành công; nếu worker crash giữa chừng, job vẫn nằm trong pending list và có thể được `XAUTOCLAIM` lại bởi worker khác.
