# Ecommerce Polyglot Demo — Next.js + MongoDB + PostgreSQL + Redis + FastAPI

Demo chạy được thật: một shop nhỏ (danh sách sản phẩm → giỏ hàng → thanh toán → đơn hàng) nhưng cố tình dùng
**nhiều loại DB khác nhau cho đúng việc của nó**, thay vì nhét hết vào 1 DB duy nhất — điểm học được ở đây là
cách chọn DB theo đặc tính dữ liệu, không phải "dùng gì cũng được".

## Kiến trúc

```
                         ┌────────────────────┐
                         │   Next.js (web)     │  App Router, SSR cho trang sản phẩm
                         │   :3000              │  client component cho cart/checkout/login
                         └─────────┬───────────┘
                                   │ REST (JSON)
                                   ▼
                         ┌────────────────────┐
                         │   FastAPI (api)     │  backend duy nhất, là nơi quyết định
                         │   :8000              │  ghi vào DB nào cho từng loại dữ liệu
                         └───┬───────┬────────┬─┘
                             │       │        │
                 đọc sản phẩm│  giỏ hàng│  đơn hàng + thanh toán + user
                             ▼       ▼        ▼
                   ┌──────────┐ ┌────────┐ ┌────────────┐
                   │ MongoDB  │ │ Redis  │ │ PostgreSQL │
                   │ (catalog)│ │        │ │ (orders,   │
                   └──────────┘ │        │ │  users,    │
                                 │        │ │  carts)    │
                                 └────────┘ └────────────┘
```

- **MongoDB — catalog sản phẩm**: dữ liệu sản phẩm mỗi loại một khác (thông số kỹ thuật khác nhau giữa bàn
  phím và màn hình chẳng hạn), đọc nhiều hơn ghi, không cần transaction. Document model hợp hơn là ép vào
  bảng SQL cứng nhắc.
- **Redis — 2 vai trò khác nhau, không lẫn lộn**:
  - **Nguồn sự thật** cho giỏ hàng **ẩn danh** (chưa đăng nhập): Redis Hash `cart:<cart_id>` → `product_id:
    quantity`, TTL 7 ngày — dữ liệu tạm, mất cũng không sao.
  - **Chỉ là cache** cho giỏ hàng của **user đã đăng nhập**: `usercart:<user_id>`, TTL 5 phút, bị xoá
    (invalidate) ngay mỗi lần ghi — Postgres mới là nguồn sự thật ở đây.
  - Còn dùng làm **lock chống double-submit** khi checkout (`SET NX EX` trên `checkout_lock:<id>`) — bấm
    "Đặt hàng" 2 lần liên tục chỉ tạo 1 đơn, áp dụng cho cả 2 loại giỏ hàng.
- **PostgreSQL — dữ liệu cần ACID + quan hệ**: đơn hàng/thanh toán (tiền, trạng thái phải nhất quán, có
  transaction), và **giỏ hàng của user đã đăng nhập** (`users` → `carts` → `cart_items`) — bền theo tài khoản,
  không mất khi hết TTL, đúng như cách Shopee/Lazada giữ giỏ hàng lâu dài cho user đã login (xem thêm phần
  "2 loại giỏ hàng" bên dưới).
- **FastAPI** là backend duy nhất, không để Next.js nói chuyện trực tiếp với DB nào — mọi quyết định "dữ liệu
  này thuộc DB nào" nằm ở tầng backend.

### 2 loại giỏ hàng — vì sao không dùng chung 1 cơ chế

Ban đầu demo chỉ có giỏ hàng ẩn danh lưu trong Redis với TTL 7 ngày. Thực tế Shopee/Lazada giữ giỏ hàng của
user đã đăng nhập **lâu hơn nhiều** (gần như vô thời hạn) vì nó gắn với tài khoản trong DB bền vững, không
phải session có hạn — Redis ở các site đó chỉ đóng vai trò cache đọc nhanh. Demo này mô phỏng lại đúng 2 tầng
đó thay vì chỉ có 1:

| | Giỏ hàng ẩn danh (guest) | Giỏ hàng user đã đăng nhập |
|---|---|---|
| Định danh | `cart_id` (UUID) trong `localStorage` | `user_id` sau khi đăng nhập |
| Nguồn sự thật | Redis (`cart:<cart_id>`) | PostgreSQL (`carts`, `cart_items`) |
| Vai trò của Redis | Toàn bộ dữ liệu | Chỉ cache đọc, TTL 5 phút, invalidate mỗi lần ghi |
| Tồn tại bao lâu | TTL 7 ngày rồi mất | Không giới hạn — còn tài khoản là còn giỏ hàng |
| Header gửi lên API | `X-Cart-Id` | `X-User-Id` |

Khi đăng nhập (`POST /api/auth/login`), frontend gọi tiếp `POST /api/cart/merge` để **gộp giỏ hàng ẩn danh
hiện tại (nếu có) vào giỏ hàng bền của tài khoản** rồi xoá giỏ ẩn danh — giống cách Shopee gộp giỏ hàng khách
vào tài khoản lúc đăng nhập. `X-User-Id` luôn được ưu tiên hơn `X-Cart-Id` ở mọi endpoint `/api/cart*`.

Đăng nhập ở đây là **giả lập cho mục đích demo** (`POST /api/auth/login`): chỉ cần nhập email + tên, không có
mật khẩu, không JWT/session thật — tạo (hoặc lấy lại) một `User` trong Postgres để có `user_id` ổn định gắn
giỏ hàng vào. Không phải ví dụ về auth an toàn.

### Luồng checkout (điểm đáng chú ý nhất)

```
POST /api/orders (X-User-Id hoặc X-Cart-Id, thông tin khách + thẻ)
        │
        ▼
1. SET NX checkout_lock:<user_id hoặc cart_id> ──▶ đã có lock? trả 409, không tạo đơn trùng
        │ chưa có lock, tiếp tục
        ▼
2. Đọc giỏ hàng - user: query thẳng Postgres (bỏ qua cache, luôn lấy số lượng mới nhất)
                 - guest: đọc Redis, enrich giá/tên từ MongoDB
        │
        ▼
3. INSERT order (status=pending) + order_items trong 1 transaction Postgres
        │
        ▼
4. "Gọi" mock payment gateway (không ra ngoài thật) → success | failed
   quy ước demo: số thẻ kết thúc bằng 0000 → luôn thất bại
        │
        ▼
5. INSERT payment, UPDATE order.status = paid | failed, COMMIT
        │
        ▼
6. Nếu paid: xoá giỏ hàng - user: DELETE cart_items trong Postgres + xoá cache
                          - guest: xoá key trong Redis
   Nếu failed: giữ nguyên giỏ hàng để thử lại
        │
        ▼
7. Xoá checkout_lock (finally, kể cả khi lỗi)
```

## Chạy bằng Docker

```bash
cd demos/ecommerce-polyglot-demo
docker compose up --build
```

- Web: [http://localhost:3000](http://localhost:3000)
- API (Swagger docs): [http://localhost:8000/docs](http://localhost:8000/docs)
- Postgres: `localhost:5432` (user/pass: `postgres`/`postgres`, db `orders`)
- Mongo: `localhost:27017` (db `catalog`)
- Redis: `localhost:6379`

MongoDB được **tự động seed** 6 sản phẩm mẫu khi API khởi động lần đầu (nếu collection `products` rỗng) —
không cần chạy script riêng.

### Xem dữ liệu bằng GUI (Adminer + mongo-express)

Muốn xem trực tiếp dữ liệu trong Postgres/Mongo mà không cần `psql`/`mongosh`, hoặc không muốn cài app desktop
(TablePlus, DBeaver, MongoDB Compass...) — có sẵn 2 GUI chạy trong Docker, đặt trong profile `tools` nên
**không tự khởi động** cùng `docker compose up` bình thường:

```bash
docker compose --profile tools up -d adminer mongo-express
```

- **Adminer** (Postgres) — [http://localhost:8080](http://localhost:8080). Đăng nhập: System chọn
  `PostgreSQL`, Server đã tự điền `postgres`, Username/Password `postgres`/`postgres`, Database `orders`.
  Adminer chỉ hỗ trợ DB dạng SQL, **không dùng được cho MongoDB**.
- **mongo-express** (MongoDB) — [http://localhost:8081](http://localhost:8081), không cần đăng nhập (đã tắt
  basic-auth mặc định của image qua `ME_CONFIG_BASICAUTH: "false"` — chỉ hợp lý vì đây là GUI dev cục bộ,
  không expose ra ngoài). Chọn database `catalog` → collection `products` để xem sản phẩm.

Dừng riêng 2 service này mà không đụng vào stack chính:

```bash
docker compose --profile tools stop adminer mongo-express
```

### Thử luồng thanh toán

Mở [http://localhost:3000](http://localhost:3000) → chọn 1 sản phẩm → **Thêm vào giỏ hàng** → **Giỏ hàng** →
**Thanh toán**, điền form. Số thẻ chỉ là mock, không gọi cổng thanh toán thật:

- Số thẻ **kết thúc bằng `0000`** → thanh toán **thất bại** (đơn ở trạng thái `failed`, giỏ hàng được giữ lại).
- Bất kỳ số thẻ nào khác → thanh toán **thành công** (đơn `paid`, giỏ hàng bị xoá).

### Thử giỏ hàng bền theo tài khoản (điểm mới đáng chú ý)

1. Chưa đăng nhập, thêm 1 sản phẩm vào giỏ (giỏ hàng ẩn danh, lưu ở Redis).
2. Vào **Đăng nhập**, nhập email + tên bất kỳ (không cần mật khẩu) → tự động chuyển tới **Giỏ hàng** và thấy
   sản phẩm vừa thêm vẫn còn — đã được gộp từ giỏ ẩn danh vào giỏ của tài khoản.
3. Mở tab ẩn danh (Incognito) hoặc xoá `localStorage`, đăng nhập lại **cùng email đó** — giỏ hàng vẫn còn, vì
   giờ nó nằm trong Postgres, không phụ thuộc trình duyệt/thiết bị nữa (khác hẳn giỏ hàng ẩn danh, vốn chỉ
   sống trên 1 trình duyệt qua `localStorage`).
4. Kiểm tra Redis chỉ đóng vai trò cache (TTL ngắn, không phải nguồn dữ liệu):

   ```bash
   docker compose exec redis redis-cli KEYS "usercart:*"
   docker compose exec redis redis-cli TTL "usercart:<user_id>"   # ~300s hoặc thấp hơn
   docker compose exec redis redis-cli DEL "usercart:<user_id>"   # xoá cache thủ công
   curl -s http://localhost:8000/api/cart -H "X-User-Id: <user_id>"  # vẫn ra đúng data — build lại tu Postgres
   ```

Thử double-submit để thấy Redis lock hoạt động (áp dụng cho cả 2 loại giỏ hàng, ví dụ dưới dùng giỏ ẩn danh):

```bash
CART_ID="demo-cart"
curl -s -X POST http://localhost:8000/api/cart/items -H "Content-Type: application/json" \
  -H "X-Cart-Id: $CART_ID" -d '{"product_id":"p4","quantity":1}'

# gửi 2 request checkout gần như đồng thời trên cùng 1 cart_id
BODY='{"customer_name":"C","customer_email":"c@example.com","shipping_address":"X","payment":{"card_number":"4111111111111111","card_holder":"C","expiry":"01/29","cvv":"111"}}'
curl -s -X POST http://localhost:8000/api/orders -H "Content-Type: application/json" -H "X-Cart-Id: $CART_ID" -d "$BODY" -w "\n%{http_code}\n" &
curl -s -X POST http://localhost:8000/api/orders -H "Content-Type: application/json" -H "X-Cart-Id: $CART_ID" -d "$BODY" -w "\n%{http_code}\n" &
wait
```

Một request sẽ trả `200` (tạo đơn), request còn lại trả `409` (`"Đơn hàng đang được xử lý"`).

## Chạy không dùng Docker

Cần Mongo/Postgres/Redis chạy sẵn (hoặc `docker compose up mongo postgres redis`).

```bash
# API
cd api
pip install -r requirements.txt
MONGO_URL=mongodb://localhost:27017 \
POSTGRES_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/orders \
REDIS_URL=redis://localhost:6379/0 \
uvicorn app.main:app --reload

# Web (terminal khác)
cd web
npm install
API_INTERNAL_URL=http://localhost:8000 NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

## API

| Method | Path                        | DB đằng sau                | Mô tả                                                        |
|--------|-----------------------------|-----------------------------|---------------------------------------------------------------|
| GET    | `/api/products`             | MongoDB                     | Danh sách sản phẩm, filter `category`/`search`                |
| GET    | `/api/products/{id}`        | MongoDB                     | Chi tiết 1 sản phẩm                                            |
| POST   | `/api/auth/login`           | Postgres                    | Đăng nhập giả lập (email + tên, không mật khẩu). Get-or-create `User` |
| GET    | `/api/cart`                 | Redis hoặc Postgres+Redis   | `X-User-Id` → giỏ hàng bền (Postgres, cache Redis). `X-Cart-Id` → giỏ ẩn danh (Redis) |
| POST   | `/api/cart/items`           | như trên                    | Thêm sản phẩm vào giỏ. Body: `{ product_id, quantity }`        |
| DELETE | `/api/cart/items/{id}`      | như trên                    | Xoá 1 sản phẩm khỏi giỏ                                        |
| DELETE | `/api/cart`                 | như trên                    | Xoá sạch giỏ hàng                                              |
| POST   | `/api/cart/merge`           | Redis → Postgres            | Gộp giỏ ẩn danh vào giỏ user (gọi ngay sau login). Body: `{ guest_cart_id }`, header `X-User-Id` |
| POST   | `/api/orders`               | Postgres + Redis            | Checkout: tạo đơn, mock thanh toán, xoá giỏ nếu thành công (`X-User-Id` hoặc `X-Cart-Id`) |
| GET    | `/api/orders/{id}`          | Postgres                    | Chi tiết đơn hàng kèm items + payment                          |

`X-Cart-Id`/`X-User-Id` do frontend tự quản lý qua `localStorage` (`lib/session.ts`) — `X-User-Id` luôn được
ưu tiên nếu đã đăng nhập.

## Cấu trúc thư mục

```
ecommerce-polyglot-demo/
├── docker-compose.yml       # mongo + postgres + redis + api + web, healthcheck đầy đủ
│                              # + adminer/mongo-express (profile "tools", GUI xem DB, optional)
├── api/                      # FastAPI — backend duy nhất
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # wiring router, CORS, lifespan (init Postgres + seed Mongo)
│       ├── config.py            # đọc connection string từ env (pydantic-settings)
│       ├── payment_gateway.py   # mock cổng thanh toán (thẻ kết thúc 0000 -> failed)
│       ├── seed_data.py         # 6 sản phẩm mẫu, seed vào Mongo nếu collection rỗng
│       ├── db/
│       │   ├── mongodb.py         # Motor async client
│       │   ├── postgres.py         # SQLAlchemy async engine + session + create_all
│       │   └── redis.py             # redis.asyncio client
│       ├── models/
│       │   ├── order.py             # SQLAlchemy ORM: Order, OrderItem, Payment
│       │   ├── user.py               # SQLAlchemy ORM: User, Cart, CartItem (giỏ hàng bền)
│       │   └── schemas.py           # Pydantic request/response schemas
│       └── routers/
│           ├── products.py          # GET /api/products*
│           ├── auth.py               # POST /api/auth/login (đăng nhập giả lập)
│           ├── cart.py               # GET/POST/DELETE /api/cart* + /merge (guest Redis + user Postgres/cache)
│           └── orders.py             # POST/GET /api/orders* (checkout + lock, hỗ trợ cả 2 loại giỏ)
└── web/                       # Next.js 14 App Router, TypeScript
    ├── Dockerfile               # multi-stage, output "standalone"
    ├── app/
    │   ├── layout.tsx              # layout chung + Header
    │   ├── page.tsx                 # server component: danh sách sản phẩm (SSR)
    │   ├── product/[id]/page.tsx    # server component: chi tiết sản phẩm
    │   ├── cart/page.tsx             # client component: giỏ hàng
    │   ├── checkout/page.tsx          # client component: form thanh toán
    │   ├── login/page.tsx              # client component: đăng nhập giả lập
    │   └── order/[id]/page.tsx        # server component: xác nhận đơn hàng
    ├── components/               # Header (hiện trạng thái đăng nhập), ProductCard, AddToCartButton
    └── lib/
        ├── api.ts                  # base URL: server dùng Docker network, browser dùng localhost
        ├── session.ts                # user + cart_id trong localStorage, cartHeaders(), custom event đồng bộ Header
        └── auth.ts                    # gọi /api/auth/login rồi /api/cart/merge
```

## Vì sao 2 base URL khác nhau cho API?

`lib/api.ts` chọn URL theo nơi code đang chạy:

- **Server component** (chạy trong container `web`, phía server) → gọi thẳng qua Docker network bằng tên
  service: `API_INTERNAL_URL=http://api:8000`.
- **Client component** (chạy trên trình duyệt của người dùng, ngoài Docker network) → phải gọi qua port đã
  publish ra host: `NEXT_PUBLIC_API_URL=http://localhost:8000`.

Nhầm 2 cái này là lỗi rất hay gặp khi Next.js SSR chạy trong Docker: dùng `localhost` ở server component sẽ
gọi vào chính container `web` (không có gì lắng nghe ở đó), còn dùng tên service `api` ở client component thì
trình duyệt của người dùng không resolve được (đó là tên nội bộ trong Docker network, không phải DNS thật).

## Giới hạn của demo

- Thanh toán là mock hoàn toàn, không tích hợp cổng thật (Stripe/VNPay/...).
- **Đăng nhập là giả lập**: chỉ email + tên, không mật khẩu, không JWT/session/cookie thật — bất kỳ ai biết
  email nào đó là "đăng nhập được" vào tài khoản đó. Chỉ đủ để demo gắn giỏ hàng với `user_id`, không phải ví
  dụ về auth an toàn (thật thì cần password hashing, JWT/session, CSRF protection...).
- Không xử lý tồn kho khi đặt hàng (không trừ `stock` trong Mongo) — chỉ tập trung vào luồng polyglot
  persistence + checkout, không phải nghiệp vụ ecommerce đầy đủ.
- Không có trang lịch sử đơn hàng theo tài khoản — `orders` hiện chưa gắn `user_id`, đơn hàng chỉ tra được
  qua link `/order/{id}` ngay sau khi đặt.
