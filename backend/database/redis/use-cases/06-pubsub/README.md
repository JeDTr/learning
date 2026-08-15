# Pub/Sub — real-time messaging

Chat app, thông báo real-time, đồng bộ giữa các service.

## Ví dụ

```
SUBSCRIBE chat:room1
PUBLISH chat:room1 "{\"user\":\"an\",\"msg\":\"hello\"}"
```

- Mọi client đang `SUBSCRIBE` kênh `chat:room1` sẽ nhận message ngay lập tức.
- Có thể dùng `PSUBSCRIBE chat:*` để subscribe theo pattern.

## Giới hạn quan trọng

- Pub/Sub của Redis **không lưu lại message** (fire-and-forget). Nếu client mất kết nối, message trong lúc đó bị mất luôn.
- Không phù hợp cho message cần đảm bảo được xử lý (dùng Redis Streams hoặc message broker chuyên dụng thay thế).

## Use case phù hợp

- Broadcast sự kiện real-time không quan trọng nếu miss 1 vài message (typing indicator, online status).
- Đồng bộ cache invalidation giữa nhiều instance backend.

## Giải pháp thay thế Redis

| Giải pháp | Ưu điểm | Nhược điểm | Khi nào nên dùng |
|---|---|---|---|
| **Kafka** | Lưu lại message (durable), replay được, throughput cao, nhiều consumer group độc lập | Phức tạp, độ trễ cao hơn Redis Pub/Sub, overkill cho hệ thống nhỏ | Cần message không được mất, nhiều service cùng subscribe và xử lý độc lập |
| **RabbitMQ** (exchange fanout/topic) | Đảm bảo delivery, hỗ trợ routing phức tạp | Độ trễ cao hơn Redis, vận hành phức tạp hơn | Cần đảm bảo message tới đích, routing theo nhiều điều kiện |
| **WebSocket server không qua broker** (Socket.IO single instance) | Đơn giản nhất, độ trễ thấp nhất | Không scale ngang được nếu không có broker chung, mỗi instance chỉ biết client của mình | App real-time chạy 1 instance, số lượng client nhỏ |
| **Managed Pub/Sub** (AWS SNS, Google Pub/Sub) | Không cần tự vận hành, tự động scale, tích hợp tốt với hệ sinh thái cloud | Tốn phí, độ trễ cao hơn Redis, phụ thuộc cloud provider | Hệ thống chạy trên cloud, muốn giảm vận hành, cần tích hợp nhiều service khác trong cùng cloud |

**Khi nào chọn Redis**: cần độ trễ cực thấp, không quan trọng nếu miss message khi mất kết nối, và hệ thống đã có sẵn Redis cho việc khác (giảm thêm thành phần hạ tầng).

## Ví dụ triển khai theo framework

API mẫu: publish tin nhắn vào 1 phòng chat (`PUBLISH`) + subscriber riêng lắng nghe (`SUBSCRIBE`).

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều dùng channel `chat:{room}`. Lưu ý: kết nối dùng để `SUBSCRIBE` cần tách riêng khỏi kết nối dùng để `PUBLISH`/lệnh khác (đặc điểm chung của Redis client).
