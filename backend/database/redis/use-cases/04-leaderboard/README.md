# Leaderboard / Ranking

Bảng xếp hạng game, top sản phẩm bán chạy... dùng **Sorted Set** cực nhanh cho việc sắp xếp real-time.

## Ví dụ

```
ZADD leaderboard 1500 "player:1"
ZADD leaderboard 2300 "player:2"
ZINCRBY leaderboard 50 "player:1"       # cộng thêm điểm

ZREVRANGE leaderboard 0 9 WITHSCORES    # top 10
ZRANK leaderboard "player:1"            # xem hạng của 1 player
ZSCORE leaderboard "player:1"           # xem điểm hiện tại
```

## Vì sao dùng Sorted Set

- Redis tự động giữ dữ liệu được sắp xếp theo `score`, không cần sort lại mỗi lần query.
- Các thao tác `ZADD`, `ZRANK`, `ZRANGE` đều có độ phức tạp O(log N), đủ nhanh cho real-time leaderboard hàng triệu người chơi.

## Use case

- Xếp hạng người chơi game theo điểm số.
- Top sản phẩm bán chạy trong ngày/tuần.
- Trending posts/hashtag theo lượt tương tác.

## Giải pháp thay thế Redis

| Giải pháp | Ưu điểm | Nhược điểm | Khi nào nên dùng |
|---|---|---|---|
| **RDBMS** (`ORDER BY score DESC LIMIT N` + index trên cột score) | Không cần thêm hạ tầng, dữ liệu nhất quán với nguồn chính, dễ query kèm thông tin liên quan (join) | Chậm hơn nhiều khi bảng lớn và truy vấn top-N liên tục, `RANK()` window function tốn tài nguyên hơn `ZRANK` | Bảng xếp hạng ít người xem, không cần cập nhật real-time, số lượng bản ghi vừa phải |
| **Elasticsearch** | Query mạnh (filter, full-text kết hợp sort), scale tốt cho dữ liệu lớn | Phức tạp hơn để vận hành, độ trễ index không phải real-time tuyệt đối (near real-time) | Leaderboard cần kết hợp tìm kiếm/filter phức tạp (theo khu vực, category...) cùng lúc |
| **In-memory data structure trong app** (heap/sorted list) | Nhanh nhất, không cần thêm hạ tầng | Không dùng chung giữa nhiều instance, mất dữ liệu khi restart | App chạy 1 instance, leaderboard tạm thời/nhỏ (ví dụ 1 ván game đơn) |

**Khi nào chọn Redis**: cần cập nhật điểm và đọc top-N real-time, dùng chung giữa nhiều server, và số lượng người chơi/bản ghi lớn (hàng trăm nghìn đến hàng triệu).

## Ví dụ triển khai theo framework

API mẫu: set điểm, cộng điểm, lấy top N, xem hạng của 1 người chơi.

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều dùng chung 1 key Sorted Set (`leaderboard:game1`) và cùng bộ lệnh `ZADD` / `ZINCRBY` / `ZREVRANGE` / `ZREVRANK` / `ZSCORE`.
