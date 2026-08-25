# Chat Demo — 4 cơ chế fanout tin nhắn realtime

Một chat app 1-1 kiểu Messenger (danh sách hội thoại, tin nhắn, "đang gõ...", trạng thái online), triển khai
**4 lần** bằng 4 cơ chế đẩy tin nhắn realtime khác nhau, để so sánh trực tiếp cạnh nhau:

| Biến thể | Công nghệ | Vai trò |
|---|---|---|
| [`socketio-redis-pubsub/`](socketio-redis-pubsub) | Socket.IO + `@socket.io/redis-adapter` | Pub/sub thuần, đơn giản nhất, không có bộ nhớ đệm |
| [`redis-streams/`](redis-streams) | Redis Streams + consumer group riêng mỗi instance | Có ack, resume được sau crash |
| [`kafka/`](kafka) | Kafka topic (partition theo hội thoại) + consumer group riêng mỗi instance | Đảm bảo thứ tự, log bền lâu dài, scale ngang |
| [`mqtt/`](mqtt) | MQTT broker (Mosquitto) + topic riêng từng user, subscribe động | Lọc tại broker, retained message, QoS |

Cả 4 biến thể dùng **chung 1 database SQLite** (qua Docker volume) để lưu lịch sử hội thoại, và **chung 1 danh
sách 3 user cố định** (`alice`, `bob`, `carol`, không có auth). Đây là điểm cố ý: lịch sử chat phải giống hệt
nhau dù bạn mở port nào, vì persistence hoàn toàn tách biệt khỏi cơ chế đẩy tin nhắn realtime — chỉ có đường đi
của tin nhắn "trực tiếp lúc đang online" là khác nhau. Cùng bài học đã áp dụng ở
[`notification-sse-websocket-demo`](../notification-sse-websocket-demo).

Mỗi biến thể chạy **2 instance server** (`-a` / `-b`) để mô phỏng môi trường có nhiều pod/server đứng sau load
balancer — đúng bài toán thực tế mà cả 4 cơ chế này được sinh ra để giải quyết: "user A gửi tin cho user B,
nhưng request của A rơi vào instance khác với instance đang giữ kết nối của B, làm sao tin nhắn tới được B?"

## Kiến trúc chung

```
        browser (Alice)                          browser (Bob)
              │                                         │
      POST /api/messages                        WS/Socket.IO connect
      (có thể vào bất kỳ                         (rơi vào 1 instance
       instance nào)                              bất kỳ, vd instance B)
              │                                         │
              ▼                                         ▼
      ┌───────────────┐                         ┌───────────────┐
      │  instance A    │                         │  instance B    │
      │  1) luu SQLite │                         │  giu ket noi   │
      │  2) publish    │                         │  cua Bob       │
      └───────┬────────┘                         └───────▲────────┘
              │                                           │
              │        CO CHE FANOUT (khac nhau giua 4 bien the)
              └──────────────────────────────────────────►┘
                 socket.io-redis-adapter | redis streams |
                        kafka topic | mqtt broker
```

SQLite (1 volume dùng chung bởi cả 8 instance) đảm nhận vai trò "nguồn sự thật" cho lịch sử hội thoại. Còn
**cơ chế fanout** chỉ đảm nhận đúng 1 việc: đẩy tin nhắn *đang xảy ra* tới đúng instance đang giữ kết nối của
người nhận. 4 cách làm việc đó khác nhau như sau:

### 1. Socket.IO + Redis pub/sub — [`socketio-redis-pubsub/`](socketio-redis-pubsub/src/index.js)

Mỗi user join 1 room `user:<id>`. Server chỉ cần gọi `io.to('user:'+to).emit(...)`;
`@socket.io/redis-adapter` tự dùng Redis pub/sub để phát event đó tới đúng instance đang giữ socket trong room
— không cần tự viết channel, không cần tự viết presence set. Tra "user này online ở đâu" cũng có sẵn qua
`io.in(room).fetchSockets()` (tự hỏi cả cluster). Đây là biến thể **ít code nhất** vì gần như mọi thứ do adapter
lo, đổi lại nó **là pub/sub thuần** — không có bộ nhớ đệm nào. Nếu instance đang giữ người nhận offline/crash
đúng lúc publish, message đó **mất vĩnh viễn** khỏi luồng live (không ai nhận lại được qua kênh realtime); người
nhận chỉ thấy nó khi tải lại lịch sử từ SQLite lúc kết nối lại.

### 2. Redis Streams — [`redis-streams/`](redis-streams/src/bus.js)

Publish vào 1 Redis Stream (`chat:events`). Điểm mấu chốt: **mỗi instance tạo 1 consumer group mang tên chính
nó** (thay vì dùng chung 1 group để chia tải như cách dùng phổ biến) — nên *mọi* instance đều nhận được *mọi*
event (broadcast), rồi tự lọc xem client cục bộ có ai cần không. Vì group gắn với instanceId, Redis nhớ đúng vị
trí đã `XACK`; nếu instance crash rồi khởi động lại, nó **resume đúng chỗ**, không bỏ lỡ event phát sinh trong
lúc down — khác hẳn biến thể pub/sub thuần ở trên.

### 3. Kafka — [`kafka/`](kafka/src/bus.js)

Cùng tinh thần broadcast-qua-consumer-group-riêng như Redis Streams, nhưng trên Kafka topic (`chat-events`, 3
partition). Điểm khác: message được **key bằng `conversationId`**, nên Kafka đảm bảo mọi tin nhắn trong cùng 1
hội thoại luôn nằm trên cùng 1 partition — **thứ tự (ordering)** được giữ đúng tuyệt đối kể cả khi nhiều
instance ghi đồng thời. Kafka cũng giữ log lâu hơn hẳn Redis (retention theo thời gian/dung lượng), nên dễ thêm
1 consumer group mới (vd service phân tích) đọc lại toàn bộ mà không đụng gì tới producer/consumer hiện tại. Đổi
lại, hạ tầng nặng hơn nhiều so với Redis.

### 4. MQTT — [`mqtt/`](mqtt/src/bus.js)

Khác hẳn 2 biến thể trên (broadcast rồi tự lọc), MQTT **lọc ngay tại broker**: mỗi tin nhắn publish vào topic
*riêng của người nhận* (`chat/user/<id>/msg`), và chỉ instance nào đang thực sự giữ kết nối cục bộ của user đó
mới **subscribe động** topic ấy (subscribe lúc connect, unsubscribe lúc disconnect). Instance không liên quan
không nhận được gói tin nào — do broker không bao giờ gửi, không phải do code tự bỏ qua. Trạng thái online dùng
**retained message**: subscribe `chat/presence/+` bất kỳ lúc nào cũng lập tức có ngay giá trị mới nhất, không
cần đợi event mới phát sinh.

## Bảng so sánh

| Tiêu chí | Socket.IO+Redis pub/sub | Redis Streams | Kafka | MQTT |
|---|---|---|---|---|
| Cách lọc người nhận | Room (adapter lo) | Broadcast + lọc cục bộ | Broadcast + lọc cục bộ | Lọc tại broker (topic/subscribe) |
| Mất tin khi instance down? | Có (fire-and-forget) | Không (resume từ offset đã ack) | Không (resume từ offset đã commit) | Có (không bật persistence) |
| Đảm bảo thứ tự | Theo thứ tự publish tới room | Theo thứ tự trong stream | Đảm bảo tuyệt đối trong 1 partition (key=conversationId) | Theo thứ tự publish (QoS 1) |
| Replay lịch sử event | Không | Có (giới hạn bởi RAM Redis) | Có (retention dài, dễ thêm consumer mới) | Không (trừ retained = giá trị mới nhất) |
| Code cần tự viết | Rất ít (adapter lo hết) | Trung bình (tự quản consumer group + presence) | Trung bình (tự quản consumer group + presence) | Trung bình (tự quản subscribe động + presence) |
| Hạ tầng | Redis | Redis | Kafka (nặng nhất) | Broker MQTT (nhẹ) |
| Hợp nhất khi nào | Chat/notification đơn giản, chấp nhận mất tin lúc downtime | Cần độ tin cậy cao hơn nhưng hạ tầng vẫn gọn (Redis) | Throughput lớn, cần audit/replay, nhiều consumer khác nhau đọc cùng dữ liệu | Rất nhiều topic/user, cần lọc hiệu quả tại broker, thiết bị nhẹ (IoT-style) |

## Chạy bằng Docker

```bash
cd demos/chat-realtime-demo
docker compose up --build
```

Khởi động: Redis, 1 Kafka broker (KRaft mode, 1 node), 1 Mosquitto broker, và 8 instance server (2 mỗi biến
thể):

| Biến thể | Instance A | Instance B |
|---|---|---|
| Socket.IO + Redis pub/sub | [http://localhost:4001](http://localhost:4001) | [http://localhost:4002](http://localhost:4002) |
| Redis Streams | [http://localhost:4011](http://localhost:4011) | [http://localhost:4012](http://localhost:4012) |
| Kafka | [http://localhost:4021](http://localhost:4021) | [http://localhost:4022](http://localhost:4022) |
| MQTT | [http://localhost:4031](http://localhost:4031) | [http://localhost:4032](http://localhost:4032) |

Mỗi trang có badge hiển thị `instance: ... · variant: ...`. Cách so sánh nhanh nhất: mở 2 tab của **cùng 1 biến
thể** nhưng **khác instance** (vd `:4011` và `:4012`), chọn "Bạn là" khác nhau ở mỗi tab (vd Alice ở tab 1, Bob
ở tab 2), rồi chat qua lại — tin nhắn phải tới ngay lập tức dù 2 tab đang nói chuyện với 2 server khác nhau.

### Kịch bản test riêng cho từng biến thể

**Socket.IO + Redis pub/sub** — test mất tin khi down:
```bash
# Bob dang mo tab tro :4002 (instance socketio-b)
docker kill -s SIGKILL chat-realtime-demo-socketio-b-1
# Alice gui tin cho Bob qua :4001 trong luc socketio-b da chet
curl -X POST http://localhost:4001/api/messages -H "Content-Type: application/json" \
  -d '{"me":"alice","to":"bob","body":"gui luc Bob offline"}'
docker compose up -d socketio-b
# Mo lai tab Bob (:4002) -> tin nhan CHI xuat hien qua lich su REST luc load lai,
# khong co push realtime nao ca vi pub/sub khong giu lai gi
```

**Redis Streams** — test resume không mất event:
```bash
docker kill -s SIGKILL chat-realtime-demo-streams-b-1
curl -X POST http://localhost:4011/api/messages -H "Content-Type: application/json" \
  -d '{"me":"alice","to":"bob","body":"gui luc streams-b chet"}'
docker compose up -d streams-b
docker compose logs streams-b --tail 5
# -> thay dong "consumer group ... da ton tai -> resume tu vi tri da luu"
# (khong phai "tao consumer group moi" - tuc la KHONG mat vi tri da xu ly)
```

**Kafka** — test tương tự Redis Streams (`kafka-b`), đồng thời có thể quan sát ordering: gửi liên tiếp nhiều
tin trong cùng hội thoại từ 2 instance khác nhau gần như đồng thời, lịch sử `GET /api/messages` luôn giữ đúng
thứ tự vì cùng `conversationId` luôn rơi vào cùng 1 partition.

**MQTT** — test lọc tại broker (không phải broadcast):
```bash
# Bob dang mo tab tro :4032 (instance mqtt-b), khong mo tab nao o mqtt-a
docker compose logs mqtt-a --tail 50 | grep bob   # -> rong, mqtt-a chua bao gio subscribe topic cua bob
curl -X POST http://localhost:4031/api/messages -H "Content-Type: application/json" \
  -d '{"me":"alice","to":"bob","body":"test qua mqtt-a"}'
docker compose logs mqtt-a --tail 5   # -> van khong co gi nhac toi "bob"
docker compose logs mqtt-b --tail 5   # -> nhan va day xuong Bob binh thuong
```

## API chung (giống hệt trên cả 8 instance)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/health` | Health check, kèm `instanceId`, `variant` |
| GET | `/api/instance` | `{ instanceId, variant }` |
| GET | `/api/users` | Danh sách 3 user cố định |
| GET | `/api/messages?me=&with=` | Lịch sử hội thoại giữa 2 user (từ SQLite, dùng chung cho cả 4 biến thể) |
| POST | `/api/messages` | Gửi tin nhắn. Body: `{ me, to, body }`. Lưu SQLite rồi publish qua cơ chế fanout của biến thể |
| GET | `/api/presence?userId=` | `{ userId, online }` — có online ở bất kỳ instance nào trong cluster hay không |
| WS hoặc Socket.IO | `/ws/chat?userId=` (raw WS, 3 biến thể) hoặc `/socket.io?userId=` (Socket.IO) | Kênh live: nhận `message`, `typing`, `presence`; gửi `{ type: 'typing', to }` |

## Cấu trúc thư mục

```
chat-realtime-demo/
├── docker-compose.yml       # redis + kafka (KRaft) + mosquitto + 8 instance (2 x 4 bien the)
├── mosquitto/mosquitto.conf # listener 1883, allow_anonymous (chi dung noi bo)
├── socketio-redis-pubsub/
│   ├── src/index.js          # socket.io + redis-adapter, room theo userId
│   ├── src/db.js, users.js   # dung chung schema/nguoi dung voi 3 bien the kia
│   └── public/                # UI (accent xanh duong)
├── redis-streams/
│   ├── src/bus.js             # consumer group rieng moi instance (broadcast + ack + resume)
│   ├── src/index.js           # REST + WS, wiring bus vao clients cuc bo
│   ├── src/clients.js         # registry WS cuc bo theo userId
│   ├── src/presence.js        # gom presence cluster-wide tu event bus
│   └── public/                 # UI (accent cam)
├── kafka/
│   ├── src/bus.js             # topic partition theo conversationId, consumer group rieng moi instance
│   └── ... (giong redis-streams ve cau truc: index.js, clients.js, presence.js, public/ accent tim)
└── mqtt/
    ├── src/bus.js             # topic rieng tung user, subscribe/unsubscribe dong, retained presence
    └── ... (giong redis-streams ve cau truc, public/ accent xanh ngoc)
```

## Chạy không dùng Docker (1 biến thể)

Cần hạ tầng tương ứng chạy sẵn ở localhost (Redis cho 2 biến thể đầu, Kafka cho biến thể 3, Mosquitto cho biến
thể 4):

```bash
cd redis-streams   # hoac socketio-redis-pubsub / kafka / mqtt
npm install
INSTANCE_ID=a PORT=3000 npm start
# terminal khac, cung thu muc:
INSTANCE_ID=b PORT=3001 npm start
```
