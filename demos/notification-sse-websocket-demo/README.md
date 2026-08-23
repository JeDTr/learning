# Notification Demo — SSE vs WebSocket

Demo chạy được thật: cùng một notification, đẩy tới trình duyệt bằng hai kỹ thuật realtime khác nhau —
**Server-Sent Events (SSE)** và **WebSocket** — để so sánh trực tiếp cạnh nhau. Chạy 2 instance server chia sẻ
chung Redis để demo **presence lookup + route trực tiếp**: notification chỉ được gửi tới đúng instance đang
giữ kết nối của user, không broadcast tràn lan cho mọi instance.

## Kiến trúc

```
                    POST /api/notifications (có thể vào bất kỳ instance nào)
                                │
                                ▼
                      ┌──────────────────┐        1) SMEMBERS presence:<userId>
                      │  instance nhận    │───────▶  Redis (presence registry)
                      │  request (vd: B)  │◀───────  trả ve danh sach instance dang
                      └──────────────────┘        giu ket noi cua user nay
                                │
                                │ 2) PUBLISH notifications:instance:<id>
                                │    (chi gui toi dung nhung instance o buoc 1)
                                ▼
        ┌───────────────────────────────────────────┐
        │  Redis channel "notifications:instance:A"   │
        └───────────────────────────────────────────┘
                                │ subscribe (chỉ instance A lắng nghe kênh của chính nó)
                                ▼
                      ┌──────────────────┐
                      │   instance A      │── SADD/SREM presence:<userId> khi connect/disconnect
                      │  (giữ kết nối     │
                      │   SSE/WS của u1)  │
                      └──────────────────┘
                          │           │
                 GET /sse/notifications   WS /ws/notifications
                          │           │
                    EventSource    WebSocket
                    (browser)      (browser)
```

- Mỗi instance có một `INSTANCE_ID` riêng (`server-a`, `server-b`, ...) và subscribe **kênh Redis riêng của chính nó**
  (`notifications:instance:<id>`) — không subscribe một kênh chung như cách broadcast đơn giản.
- Khi client mở SSE/WS, instance đang giữ connection đó **đăng ký presence** vào Redis:
  `SADD presence:<userId> <instanceId>`. Khi client ngắt kết nối cuối cùng của user đó trên instance này,
  gỡ đăng ký bằng `SREM`.
- Khi có `POST /api/notifications`, instance nhận request (không nhất thiết là instance đang giữ kết nối của
  user) tra `SMEMBERS presence:<userId>` để biết chính xác **những instance nào** đang giữ kết nối của user đó,
  rồi chỉ `PUBLISH` vào kênh riêng của từng instance đó — instance nào không liên quan sẽ không nhận được gì cả.
- So với cách "1 kênh chung, mọi instance subscribe rồi tự lọc bằng bộ nhớ" (broadcast toàn cục), cách này tránh
  việc mọi instance đều phải nhận và xử lý mọi message dù không có connection nào liên quan — quan trọng khi số
  instance và tần suất notification lớn.
- **Self-healing khi instance crash**: mỗi instance định kỳ (10s) "tự báo còn sống" bằng một key TTL 30s
  (`instance:heartbeat:<id>`). Nếu instance chết đột ngột (không kịp `SREM`), key này tự hết hạn. Lần
  `lookupInstances()` kế tiếp sẽ thấy `presence:<userId>` còn "kẹt" trỏ tới một instance không còn heartbeat,
  tự loại nó khỏi kết quả **và** `SREM` luôn khỏi Set — dọn rác ngay tại thời điểm tra cứu, không cần job quét
  nền riêng (xem `presence.js`).
- **Inbox bền cho user offline**: khi `lookupInstances()` trả về rỗng (không instance nào đang giữ kết nối),
  notification được lưu vào SQLite (`inbox.js`) thay vì chỉ log rồi mất. Khi user mở lại SSE/WS (ở bất kỳ
  instance nào), server tra các notification chưa gửi (`delivered_at IS NULL`) trong inbox, đẩy hết cho client
  ngay khi kết nối, rồi đánh dấu đã gửi. Cố tình dùng **SQLite (DB thật)** thay vì tận dụng Redis cho việc này —
  Redis pub/sub ở demo này chỉ đóng vai trò kênh live-push, không phải nơi lưu bền; tách riêng ra một DB đúng
  vai trò của nó cũng là điểm học được ở đây: cache/pub-sub cho dữ liệu tạm thời, DB cho dữ liệu cần bền.
  2 instance server mount chung 1 volume SQLite (WAL mode) nên user offline ở instance nào, kết nối lại ở
  instance khác vẫn nhận được đủ.

## Chạy bằng Docker

```bash
cd demos/notification-sse-websocket-demo
docker compose up --build
```

Có 2 instance server chia sẻ chung Redis:

- `server-a` → [http://localhost:3000](http://localhost:3000)
- `server-b` → [http://localhost:3001](http://localhost:3001)

Mỗi trang hiển thị badge vàng cho biết đang được phục vụ bởi instance nào. Trang demo tự động kết nối cả SSE
và WebSocket với `userId=u1`. Điền tiêu đề/nội dung rồi bấm **Gửi notification** để thấy nó xuất hiện ở cả hai
cột gần như đồng thời, kèm latency đo được ở client.

Mẹo để thấy rõ presence lookup + route trực tiếp đang hoạt động:
- Mở `:3000` (server-a) và `:3001` (server-b) ở 2 tab, **cùng** `User ID = u1`.
- Gửi notification từ **bất kỳ tab nào** (request có thể chạm vào instance nào cũng được) — cả 2 tab đều nhận,
  vì cả 2 instance đều đang giữ kết nối của `u1`.
- Đóng tab của `server-b` (hoặc đổi `User ID` ở đó), rồi gửi lại notification: chỉ tab `server-a` nhận được.
  Xem `docker compose logs server-a server-b` — sẽ thấy `server-b` chỉ log dòng "routed toi instance [server-a]"
  chứ không có dòng "delivered" nào, còn `server-a` mới thực sự đẩy xuống client.
- Đổi `User ID` ở một tab rồi gửi notification cho ID khác — tab đó sẽ **không** nhận được gì.
- Tắt mạng (DevTools → Network → Offline) rồi bật lại: SSE tự reconnect (hành vi built-in của
  `EventSource`), còn WebSocket ở demo này tự viết logic reconnect có backoff — quan sát log "reconnect sau...".

Test **inbox cho user offline**: đảm bảo không tab nào đang mở với `User ID = ux`, rồi:

```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -d '{"userId":"ux","title":"Trễ hẹn","message":"Ban dang offline luc gui","type":"warning"}'

curl "http://localhost:3000/api/inbox?userId=ux"   # thấy notification nằm ở "undelivered"
```

Sau đó mở `:3000` hoặc `:3001` với `User ID = ux` — notification xuất hiện ngay khi kết nối, đánh dấu 📥 và
"trễ ... — gửi lại từ inbox" thay vì "latency". Gọi lại `GET /api/inbox?userId=ux` sẽ thấy `undelivered` rỗng.

Test **self-healing khi instance crash** (cần Docker CLI, không chỉ `docker compose`):

```bash
# 1. Mo 1 tab tro :3000 (server-a) voi User ID = uy de dang ky presence
# 2. Kill cung (khong graceful) instance dang giu ket noi:
docker kill -s SIGKILL notification-sse-websocket-demo-server-a-1
# 3. Presence van con "ket" server-a cho toi khi heartbeat TTL (30s) het han
docker compose exec redis redis-cli SMEMBERS presence:uy
# 4. Doi > 30s (hoac xoa thang key de mo phong TTL het han ngay):
docker compose exec redis redis-cli DEL instance:heartbeat:server-a
# 5. Gui notification cho uy qua server-b -> log server-b se co dong
#    "[presence] don rac 1 instance da chet khoi presence:uy -> [server-a]"
#    va notification roi thang vao inbox (vi khong con instance nao song)
curl -X POST http://localhost:3001/api/notifications \
  -H "Content-Type: application/json" -d '{"userId":"uy","title":"Sau khi server-a crash","type":"error"}'
docker compose logs server-b --tail 10
# 6. Khoi dong lai server-a, mo ket noi cho uy o dau cung duoc -> nhan notification tu inbox
docker compose up -d server-a
```

## Chạy không dùng Docker

```bash
# cần Redis chạy sẵn ở localhost:6379, ví dụ: docker run -p 6379:6379 redis:7-alpine
cd server
npm install
INSTANCE_ID=server-a PORT=3000 npm start
# mở terminal khác để chạy thêm 1 instance nếu muốn test routing:
INSTANCE_ID=server-b PORT=3001 npm start
```

`INSTANCE_ID` mặc định lấy `os.hostname()` nếu không set — trong Docker mỗi container có hostname riêng nên
vẫn hoạt động đúng dù không khai báo, nhưng để tên dễ đọc trong log/badge nên `docker-compose.yml` set tường minh.

## API

| Method | Path                     | Mô tả                                                   |
|--------|--------------------------|----------------------------------------------------------|
| POST   | `/api/notifications`     | Tạo notification mới, tra presence rồi route qua Redis (hoặc lưu inbox nếu offline). Body: `{ userId, title, message?, type? }` |
| GET    | `/sse/notifications?userId=` | Mở kết nối SSE, nhận event `notification` (kèm notification tồn đọng trong inbox nếu có) |
| WS     | `/ws/notifications?userId=`  | Mở kết nối WebSocket, nhận message `{ event: "notification", notification: {...} }` |
| GET    | `/api/inbox?userId=`     | Xem danh sách notification chưa gửi được (`delivered_at IS NULL`) của 1 user |
| GET    | `/api/instance`          | Trả về `{ instanceId }` — instance nào đang phục vụ request này |
| GET    | `/health`                | Health check, kèm `instanceId`                             |

Ví dụ gửi notification bằng `curl`:

```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","title":"Đơn hàng đã giao","message":"Kiện hàng #1024 đã tới nơi","type":"success"}'
```

## SSE vs WebSocket — khi nào dùng gì

| Tiêu chí            | SSE (Server-Sent Events)                          | WebSocket                                      |
|----------------------|----------------------------------------------------|-------------------------------------------------|
| Chiều dữ liệu         | Một chiều: server → client                         | Hai chiều: client ↔ server                       |
| Giao thức             | HTTP thường (`text/event-stream`)                  | Nâng cấp từ HTTP lên giao thức `ws`/`wss` riêng  |
| Auto-reconnect        | Có sẵn trong `EventSource`, không cần code thêm    | Không có sẵn, phải tự viết logic reconnect       |
| Đi qua proxy/firewall | Dễ, vì bản chất vẫn là HTTP                         | Đôi khi bị chặn bởi proxy cũ / middlebox khó chịu với upgrade |
| Giới hạn kết nối      | Trình duyệt giới hạn ~6 kết nối HTTP/1.1 đồng thời/domain (không áp dụng nếu dùng HTTP/2) | Không bị giới hạn này |
| Định dạng dữ liệu     | Chỉ text (thường là JSON serialize)                | Text hoặc binary                                 |
| Độ phức tạp triển khai| Thấp — chỉ cần giữ response mở và `res.write()`    | Cao hơn — cần thư viện WS, quản lý handshake, ping/pong |
| Use case điển hình     | Notification, feed cập nhật, progress bar, log stream — mọi thứ server đẩy xuống, client không cần gửi lại | Chat, collaborative editing, game, nơi client cũng cần gửi dữ liệu liên tục |

**Cho tính năng notification** (chỉ cần server đẩy xuống, client không cần phản hồi realtime) thì **SSE thường
là lựa chọn đơn giản và đủ dùng hơn** — ít hạ tầng hơn, tự reconnect, dễ debug bằng DevTools Network tab. Chỉ nên
chọn WebSocket khi cần thêm luồng ngược lại (ví dụ: client gửi "đã đọc", "đang gõ...", hoặc ghép chung với tính
năng chat 2 chiều khác trong cùng kết nối).

## Cấu trúc thư mục

```
notification-sse-websocket-demo/
├── docker-compose.yml     # redis + 2 instance server-a (3000) / server-b (3001) + volume inbox-data
└── server/
    ├── Dockerfile           # apk add python3/make/g++ để compile better-sqlite3 (native module)
    ├── package.json
    ├── src/
    │   ├── index.js          # Express app: REST, presence lookup + route/inbox, wiring SSE/WS, graceful shutdown
    │   ├── redisClient.js     # publisher/command client + subscriber theo kênh riêng từng instance
    │   ├── presence.js         # SADD/SREM/SMEMBERS presence + heartbeat TTL + tự dọn instance chết
    │   ├── inbox.js             # SQLite: lưu/đọc/đánh dấu notification cho user offline
    │   ├── clients.js           # registry kết nối cục bộ theo userId (SSE/WS)
    │   ├── sse.js                # SSE handler: đăng ký presence, replay inbox lúc connect
    │   └── websocket.js          # WebSocket handler (ws lib): ping/pong, presence, replay inbox
    └── public/
        ├── index.html            # UI demo 2 cột SSE / WebSocket + badge instance
        └── app.js                 # EventSource + WebSocket client, latency, badge "gửi lại từ inbox"
```
