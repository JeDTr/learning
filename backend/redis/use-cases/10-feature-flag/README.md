# Feature flag / Config động

Lưu config có thể thay đổi runtime mà không cần deploy lại ứng dụng.

## Ví dụ

```
SET feature:new_checkout "true"
GET feature:new_checkout

HSET config:app max_upload_mb 20 maintenance_mode false
HGETALL config:app
```

- `SET`/`GET` cho flag đơn giản (bật/tắt tính năng).
- `HSET`/`HGETALL` (Hash) phù hợp khi cần nhóm nhiều config liên quan trong 1 key.
- App đọc giá trị này khi xử lý request (có thể cache lại trong bộ nhớ local vài giây để giảm round-trip tới Redis).

## Lợi ích

- Bật/tắt tính năng tức thời cho toàn hệ thống (nhiều server) mà không cần restart hay deploy lại.
- Hỗ trợ A/B testing, canary release (kết hợp thêm logic % người dùng ở tầng ứng dụng).

## Lưu ý

- Không nên dùng làm nguồn config "gốc" duy nhất cho hệ thống lớn — nên có DB/Git lưu lịch sử thay đổi, Redis chỉ đóng vai trò cache/phân phối nhanh giá trị hiện tại.

## Giải pháp thay thế Redis

| Giải pháp | Ưu điểm | Nhược điểm | Khi nào nên dùng |
|---|---|---|---|
| **Dịch vụ feature flag chuyên dụng** (LaunchDarkly, Unleash, Flagsmith) | UI quản lý, targeting theo % user/segment, audit log, A/B testing built-in | Tốn phí (trừ bản self-host miễn phí như Unleash), thêm dependency bên ngoài | Đội ngũ lớn, cần targeting phức tạp, non-dev cũng cần bật/tắt flag qua UI |
| **DB table + cache ở app** | Không cần thêm hạ tầng ngoài DB đã có, dễ audit lịch sử thay đổi | Chậm hơn nếu đọc trực tiếp DB mỗi request (cần thêm cache riêng ở app) | Hệ thống nhỏ, ít flag, không cần thay đổi tức thời trên diện rộng |
| **Config file + redeploy** | Đơn giản nhất, review qua Git/PR, không thêm hạ tầng | Phải deploy lại để thay đổi → chậm, không phù hợp bật/tắt khẩn cấp (kill switch) | Config ít thay đổi, không cần bật/tắt real-time |
| **Environment variables** | Cực đơn giản, phù hợp CI/CD | Phải restart service để áp dụng thay đổi, không phù hợp targeting theo user | Config tĩnh theo môi trường (dev/staging/prod), không phải feature flag động thực sự |

**Khi nào chọn Redis**: cần bật/tắt tức thời trên nhiều server mà không deploy lại, và hệ thống đã có sẵn Redis nên không muốn thêm dịch vụ feature-flag riêng.

## Ví dụ triển khai theo framework

API mẫu: đọc/set 1 feature flag (`GET`/`SET`), đọc/set config nhóm (`HGETALL`/`HSET`).

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều dùng key `feature:{flagName}` (string) và `config:app` (Hash) để nhóm nhiều config liên quan.
