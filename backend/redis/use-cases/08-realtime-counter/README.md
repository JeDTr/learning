# Đếm số liệu real-time

View count, like count, online user count... cần đếm nguyên tử (atomic) mà không cần transaction phức tạp như DB truyền thống.

## Ví dụ

```
INCR post:123:views
INCRBY post:123:likes 1
DECR post:123:likes          # unlike
SADD online_users "user:42"  # set user online
SCARD online_users           # đếm số user đang online
```

- `INCR`/`DECR` là atomic, an toàn với concurrency cao (hàng nghìn request cùng lúc tăng view count).
- `SADD` + `SCARD` (Set) phù hợp để đếm số lượng phần tử duy nhất (unique online users) mà không trùng lặp.

## Đồng bộ về DB chính

- Với dữ liệu quan trọng (ví dụ like count hiển thị công khai lâu dài), nên định kỳ (hoặc qua queue) đồng bộ giá trị từ Redis về DB chính, vì Redis có thể mất dữ liệu khi crash nếu không cấu hình persistence phù hợp.

## Giải pháp thay thế Redis

| Giải pháp | Ưu điểm | Nhược điểm | Khi nào nên dùng |
|---|---|---|---|
| **DB atomic increment** (`UPDATE table SET count = count + 1`) | Không cần thêm hạ tầng, nhất quán tuyệt đối với dữ liệu chính | Chậm hơn nhiều, dễ tạo lock contention/hotspot row khi tần suất tăng cao | Tần suất tăng thấp, cần nhất quán tuyệt đối ngay lập tức (không chấp nhận sai lệch tạm thời) |
| **In-memory counter trong app** | Nhanh nhất, không cần thêm hạ tầng | Không dùng chung giữa nhiều instance, mất khi restart | App 1 instance, số liệu tạm thời không cần chính xác tuyệt đối |
| **Stream processing / approximate counting** (Kafka Streams, HyperLogLog) | Xử lý được khối lượng cực lớn, HyperLogLog tiết kiệm bộ nhớ cho đếm unique count gần đúng | Kết quả chỉ gần đúng (approximate), phức tạp hơn để triển khai | Đếm unique visitor/impression ở quy mô rất lớn, chấp nhận sai số nhỏ (~1-2%) |

**Khi nào chọn Redis**: cần tăng số liệu tần suất cao (nghìn request/giây), chấp nhận đồng bộ định kỳ về DB thay vì ghi DB trực tiếp mỗi lần.

## Ví dụ triển khai theo framework

API mẫu: tăng view count (`INCR`), like bài viết đảm bảo unique theo user (`SADD` + `INCR`), đếm user online (`SCARD`).

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều dùng key `post:{id}:views`, `post:{id}:likes`, `post:{id}:liked_by` (Set) và `online_users` (Set).
