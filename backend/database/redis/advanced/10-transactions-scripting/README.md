# Transactions & Lua Scripting

Redis đơn luồng (single-threaded) cho việc thực thi lệnh — điều này vừa là giới hạn vừa là nền tảng để đảm bảo atomicity theo 2 cách dưới đây.

## Transaction: `MULTI` / `EXEC` / `DISCARD`

```
MULTI
INCR counter
LPUSH log "increment"
EXEC
```

- `MULTI` bắt đầu gom lệnh vào hàng đợi (không chạy ngay).
- `EXEC` chạy toàn bộ lệnh đã gom **liên tục, không xen lệnh của client khác vào giữa** (đảm bảo isolation, không đảm bảo rollback).
- `DISCARD` huỷ transaction đang gom, không chạy gì cả.

### Lưu ý quan trọng: không có rollback thật

- Nếu 1 lệnh trong transaction lỗi **lúc runtime** (ví dụ `INCR` trên 1 key đang chứa string không phải số), các lệnh khác trong `EXEC` **vẫn chạy bình thường** — Redis không tự động rollback các lệnh đã chạy trước đó.
- Chỉ lỗi cú pháp lúc queue lệnh (trước `EXEC`) mới khiến toàn bộ transaction bị huỷ.

## `WATCH` — optimistic locking

```
WATCH account:1 account:2
balance1 = GET account:1
balance2 = GET account:2
# ... tính toán ở phía client ...
MULTI
SET account:1 <new_balance1>
SET account:2 <new_balance2>
EXEC   # trả về nil nếu account:1 hoặc account:2 đã bị thay đổi bởi client khác kể từ lúc WATCH
```

- Dùng cho pattern "đọc — tính toán ở client — ghi có điều kiện" (ví dụ chuyển khoản giữa 2 tài khoản).
- Nếu key bị `WATCH` thay đổi bởi client khác trước khi `EXEC`, toàn bộ transaction bị huỷ (trả `nil`) — app cần tự retry.

## Lua Scripting — atomic mạnh hơn transaction

```
EVAL "
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current < tonumber(ARGV[1]) then
    return redis.call('INCRBY', KEYS[1], ARGV[1])
else
    return -1
end
" 1 counter 10
```

```
SCRIPT LOAD "<lua code>"     # nạp trước, trả về SHA1 hash
EVALSHA <sha1> 1 counter 10   # gọi lại bằng hash, tránh gửi lại toàn bộ script mỗi lần (tiết kiệm băng thông)
```

- Toàn bộ script chạy **atomic tuyệt đối** — không client nào khác chen vào giữa, kể cả có logic điều kiện phức tạp (`if/else`, vòng lặp) mà transaction thường (`MULTI/EXEC`) không làm được vì `MULTI/EXEC` không hỗ trợ đọc giá trị rồi rẽ nhánh ngay trong transaction.
- Đây chính là cơ chế được dùng trong ví dụ [use-cases/07-distributed-lock](../../use-cases/07-distributed-lock/README.md) (script kiểm tra token đúng chủ sở hữu rồi mới `DEL`).

## So sánh Transaction vs Lua Script

| Tiêu chí | `MULTI/EXEC` | Lua Script |
|---|---|---|
| Logic điều kiện (if/else theo giá trị đọc được) | Không hỗ trợ trong transaction | Hỗ trợ đầy đủ |
| Độ phức tạp triển khai | Đơn giản | Cần viết Lua, khó debug hơn |
| Atomicity | Isolation tốt, nhưng không rollback khi lỗi runtime | Atomic tuyệt đối, dừng ngay nếu lỗi |
| Phù hợp | Gộp nhiều lệnh độc lập không cần đọc-trước-khi-ghi phức tạp | Cần đọc giá trị rồi quyết định ghi gì (rate limit, lock, đấu giá...) |

## Lưu ý

- Vì Redis single-threaded, **script/transaction chạy càng lâu thì càng block toàn bộ server** — tránh viết Lua script có vòng lặp lớn hoặc gọi lệnh có độ phức tạp cao (`KEYS`, `SORT` không giới hạn) bên trong.
- Với logic đơn giản như `INCR`, `SADD` đã atomic sẵn — không cần transaction/script, chỉ dùng khi cần gộp nhiều thao tác hoặc có điều kiện phụ thuộc giá trị đọc trước đó.

## Ví dụ triển khai theo framework

API mẫu: chuyển tiền giữa 2 "tài khoản" (key số dư) theo 2 cách — Lua script và `WATCH`/`MULTI`/`EXEC` — để so sánh trực tiếp.

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`, `pipeline()` cho watch/multi)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều có `POST /transfer/lua` (script kiểm tra đủ số dư rồi trừ/cộng trong 1 bước atomic) và `POST /transfer/watch` (đọc số dư, `WATCH` key nguồn, retry tối đa 5 lần nếu `EXEC` bị huỷ do đụng độ) — minh hoạ rõ khác biệt giữa 2 cách tiếp cận nêu trên.
