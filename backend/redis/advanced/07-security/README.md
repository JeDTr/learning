# Security

Redis mặc định **không có auth, không mã hoá** — mọi cấu hình mặc định đều ưu tiên hiệu năng hơn bảo mật, nên phải tự cấu hình thêm cho production.

## Authentication

### `requirepass` (đơn giản, Redis mọi phiên bản)

```conf
requirepass "a_very_strong_random_password"
```

```
AUTH a_very_strong_random_password
```

- Chỉ có 1 password dùng chung cho mọi client — không phân quyền được.

### ACL (Access Control List — từ Redis 6+, khuyến nghị)

```
ACL SETUSER app_readonly on >app_password ~product:* +get +mget -@dangerous
ACL SETUSER app_worker on >worker_password ~queue:* ~stream:* +@all -flushall -flushdb
ACL LIST
```

- Tạo user riêng cho từng service, giới hạn theo:
  - **Key pattern** (`~product:*`): chỉ được truy cập key khớp pattern.
  - **Lệnh** (`+get`, `-@dangerous`): whitelist/blacklist lệnh hoặc cả nhóm lệnh (category).
- Ví dụ thực tế: service chỉ đọc cache thì cấp user chỉ có quyền `GET`/`MGET` trên đúng prefix key của nó, không cho `FLUSHALL`/`CONFIG`.

## Mã hoá kết nối (TLS)

```conf
tls-port 6380
tls-cert-file /etc/redis/redis.crt
tls-key-file /etc/redis/redis.key
tls-ca-cert-file /etc/redis/ca.crt
```

- Redis không mã hoá traffic theo mặc định (khác HTTPS) — nếu client và server đi qua mạng không tin cậy (internet, cross-region), bắt buộc bật TLS, nếu không mật khẩu/dữ liệu truyền dạng plaintext.

## Giới hạn network

```conf
bind 10.0.1.5              # chỉ lắng nghe ở địa chỉ nội bộ, KHÔNG bind 0.0.0.0 nếu không cần
protected-mode yes
port 6379                  # cân nhắc đổi port mặc định để giảm bị quét tự động
```

- Đặt Redis trong private subnet/VPC, chỉ cho phép truy cập từ security group/firewall rule của chính các service cần dùng.

## Vô hiệu hoá lệnh nguy hiểm

```conf
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command CONFIG "CONFIG_9f3a1b"
```

- Đổi tên hoặc tắt hẳn các lệnh có thể gây mất dữ liệu toàn bộ hoặc đổi cấu hình nếu bị lộ quyền truy cập.

## Checklist tối thiểu cho production

- [ ] `requirepass` hoặc ACL đã bật, mật khẩu đủ mạnh/ngẫu nhiên.
- [ ] `bind` giới hạn địa chỉ nội bộ, không expose ra internet.
- [ ] Firewall/security group chỉ mở port Redis cho đúng service cần dùng.
- [ ] TLS bật nếu traffic đi qua mạng không tin cậy.
- [ ] Các lệnh `FLUSHALL`/`FLUSHDB`/`CONFIG`/`SHUTDOWN` bị hạn chế hoặc đổi tên.
- [ ] Không dùng chung 1 password/user cho mọi service — ưu tiên ACL theo từng service.

## Ví dụ triển khai theo framework

API mẫu: kết nối bằng ACL user riêng (`app_readonly`, chỉ có quyền đọc key `product:*`) qua kênh TLS.

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`, option `username`/`ssl`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, connection với `scheme => 'tls'`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`, option `username`/`tls`)

Cả 3 đều dùng chung ý tưởng: mỗi service có 1 user ACL riêng, giới hạn đúng key pattern + lệnh cần thiết (ví dụ chỉ `GET`/`MGET`) — nếu credential của 1 service bị lộ, thiệt hại chỉ giới hạn trong phạm vi quyền của user đó thay vì toàn bộ dữ liệu.
