# Elasticsearch Demo — Full-text Search & Logging (Monitoring qua Kibana)

Demo chạy được thật, kết nối trực tiếp tới **Elastic Cloud** (không chạy Elasticsearch trong Docker) — minh hoạ
tính năng full-text search đã nói ở [backend/database/elasticsearch/README.md](../../backend/database/elasticsearch/README.md).

1. **Full-text search**: search có relevance scoring, fuzzy match (chịu gõ sai), tìm không dấu tiếng Việt, highlight, filter theo category (facet).
2. **Logging** (backend + frontend): mọi request tới API, và lỗi JS chưa bắt được ở browser, đều tự động ghi
   thành document vào Elasticsearch (structured logging) — không cần thêm hạ tầng gì khác. **Monitoring/dashboard
   không tự code** — dùng thẳng Kibana Discover/Dashboards để xem.

## Kiến trúc

```
Browser ──► React SPA (nginx :3000) ──► FastAPI (:8000) ──► Elasticsearch (Elastic Cloud)
                  (Vite + TS)         proxy "/api/*"  │        index: demo_articles       (full-text search)
                     │                                │        index: demo_logs           (backend request logs)
                     │ lỗi JS chưa bắt (window.onerror)│        index: demo_frontend_logs  (frontend logs)
                     └──► POST /api/frontend-logs ─────┤
                                                        │
                                              RequestLoggingMiddleware
                                              (mọi request /api/* tự ghi 1 doc vào demo_logs)
                                                        │
                                                        ▼
                                             Kibana (Discover / Dashboards)
                                             — xem & giám sát, KHÔNG code lại ở app này
```

- **2 service**: `web` (React SPA, build tĩnh phục vụ qua nginx) và `api` (FastAPI) — nginx proxy mọi request
  `/api/*` sang service `api` qua Docker network, nên browser chỉ cần biết 1 origin duy nhất (không có vấn đề
  CORS hay 2 base URL như kiểu SSR).
- **`demo_articles`**: 16 bài viết mẫu (chủ đề database/backend, tiếng Việt), custom analyzer `vi_folding`
  (lowercase + asciifolding) để tìm được cả khi gõ không dấu.
- **`demo_logs`**: mỗi request thật (search, seed...) tự động sinh 1 log document qua middleware.
- **`demo_frontend_logs`**: lỗi JS ở browser (bắt tự động qua `window.onerror`/`unhandledrejection`, hoặc gọi
  tay `logError()`) được POST về backend rồi ghi thẳng vào Elasticsearch — browser không cần biết gì về ES/API
  key, chỉ gọi 1 endpoint same-origin.
- Cả 3 index được **tự tạo mapping đúng** lúc app khởi động (không dùng dynamic mapping mặc định), và
  `demo_articles` được **tự seed** nếu đang rỗng.

## Chuẩn bị credential Elastic Cloud

Endpoint: `https://my-security-project-d8839b.es.ap-northeast-1.aws.elastic.cloud:443`

1. Tạo API key: Elastic Cloud Console → **Security → API keys → Create API key**, hoặc qua Kibana Dev Tools:
   ```
   POST /_security/api_key
   { "name": "es-demo" }
   ```
   Copy giá trị **`encoded`** trong response (base64 của `id:api_key`).
2. Copy `api/.env.example` thành `api/.env` rồi dán API key vào:
   ```bash
   cp api/.env.example api/.env
   ```
   ```
   ELASTICSEARCH_URL=https://my-security-project-d8839b.es.ap-northeast-1.aws.elastic.cloud:443
   ELASTICSEARCH_API_KEY=<dán encoded key vào đây>
   ```

`api/.env` đã nằm trong `.gitignore` của thư mục demo này — **không commit** file này lên git.

## Chạy bằng Docker

```bash
cd demos/elasticsearch-demo
docker compose up --build
```

- App: [http://localhost:3000](http://localhost:3000)
- Swagger docs: [http://localhost:8000/docs](http://localhost:8000/docs)

Lần chạy đầu tiên, API tự tạo 3 index (`demo_articles`, `demo_logs`, `demo_frontend_logs`) và seed 16 bài viết
mẫu — không cần chạy script riêng.

## Chạy không dùng Docker

```bash
# API
cd api
pip install -r requirements.txt
cp .env.example .env   # rồi điền API key như trên
uvicorn app.main:app --reload   # http://localhost:8000

# Web (terminal khác)
cd web
npm install
npm run dev   # http://localhost:5173, Vite dev server tự proxy /api -> localhost:8000
```

## Thử tính năng full-text search

Trên trang chính:

- Gõ `"elasticsearch"` → ra bài viết đúng chủ đề, đoạn khớp được highlight.
- Gõ **không dấu**: `"may tinh"` hoặc gõ sai vài ký tự (`"elastisearch"`) → vẫn ra kết quả nhờ analyzer
  `asciifolding` + `fuzziness: AUTO`.
- Bấm vào 1 chip category (vd: `Database (7)`) → filter kết hợp với từ khóa đang tìm, số trong ngoặc chính là
  **facet count** (aggregation) tính real-time.

Hoặc gọi thẳng API:

```bash
curl "http://localhost:8000/api/search?q=redis"
curl "http://localhost:8000/api/search?q=database&category=Architecture"
curl "http://localhost:8000/api/search/suggest?q=elastic"
curl "http://localhost:8000/api/search/categories"
```

## Sinh log backend + xem trong Kibana

Nút **"Giả lập traffic (cho Kibana)"** trên UI (hoặc `POST /api/monitoring/simulate`) ghi nhanh 50 log giả vào
`demo_logs` — tỉ lệ lỗi ~10%, request lỗi có latency cao hơn hẳn, đủ đa dạng để dashboard trong Kibana có gì đó
để nhìn:

```bash
curl -X POST "http://localhost:8000/api/monitoring/simulate?count=50"
```

Log request **thật** (gõ tìm kiếm, bấm seed...) cũng tự động được ghi vào cùng index qua
`RequestLoggingMiddleware` — không cần phân biệt log thật/giả khi xem trong Kibana.

## Sinh log frontend + xem trong Kibana

`web/src/logger.ts` tự bắt 2 nguồn lỗi JS phổ biến nhất — lỗi throw ngoài try/catch (`window.onerror`) và
Promise reject chưa xử lý (`unhandledrejection`) — và gửi về `POST /api/frontend-logs`. Bấm nút **"Test lỗi
frontend (cho Kibana)"** trên UI để tạo 1 log mẫu ngay (gọi `logError()` thủ công), không cần chờ lỗi thật xảy
ra.

Gọi tay từ code khác trong app cũng được:

```typescript
import { logError, logInfo } from "./logger";

logError("Không tải được danh sách sản phẩm", err);
logInfo("User đã hoàn tất checkout");
```

Cơ chế gửi dùng `navigator.sendBeacon` (fallback `fetch` với `keepalive: true`) — đảm bảo log vẫn gửi được kể cả
khi lỗi xảy ra ngay lúc user đóng tab/điều hướng trang, thứ mà `fetch` thường bị trình duyệt huỷ giữa chừng.

**Vì sao có `POST /api/frontend-logs` ở backend thay vì browser ghi thẳng vào Elasticsearch**: browser không
được cầm API key Elastic — key đó sẽ nằm ngay trong bundle JS, ai mở DevTools cũng đọc được. Nên browser chỉ
gửi JSON thô về path same-origin, **backend mới là nơi gọi `es.index()`** bằng client/API key đã có sẵn (xem
`api/app/routers/frontend_logs.py`).

**Xem trong Kibana** (áp dụng cho cả `demo_logs` và `demo_frontend_logs`):

1. **Kibana → Stack Management → Data Views** → tạo data view trên index pattern tương ứng (field thời gian:
   `timestamp`).
2. **Kibana → Discover**, chọn data view vừa tạo → filter/search (`level: "error"`, `status_code >= 500`,
   `path: "/api/search"`...).
3. Muốn có dashboard số liệu → **Kibana → Dashboards → Create** rồi dùng **Lens** kéo-thả trên field của data
   view — đây chính là phần "monitoring" không cần tự code trong app.

## Cấu trúc thư mục

```
elasticsearch-demo/
├── docker-compose.yml       # service "api" (FastAPI) + "web" (React qua nginx). Elasticsearch là Elastic Cloud, không chạy trong Docker
├── .gitignore                 # bỏ qua api/.env, web/node_modules, web/dist
├── api/
│   ├── Dockerfile               # PYTHONUNBUFFERED=1 để log/print hiện ngay trong `docker logs`
│   ├── requirements.txt
│   ├── .env.example            # template credential ES — copy thành .env rồi điền
│   └── app/
│       ├── main.py               # wiring router, CORS, middleware, lifespan (tạo index + seed), /api/health (liveness)
│       ├── config.py              # đọc ELASTICSEARCH_URL/API_KEY từ .env (pydantic-settings)
│       ├── es_client.py            # AsyncElasticsearch client (API key hoặc basic auth)
│       ├── indices.py               # mapping demo_articles (custom analyzer) + demo_logs + demo_frontend_logs
│       ├── seed_data.py              # 16 bài viết mẫu chủ đề database/backend
│       ├── logging_middleware.py     # tự ghi mỗi request /api/* thành 1 doc vào demo_logs
│       └── routers/
│           ├── search.py               # GET /api/search, /suggest, /categories, POST /seed
│           ├── monitoring.py           # POST /simulate — CHỈ sinh dữ liệu demo, không có endpoint dashboard/stats (xem trong Kibana)
│           └── frontend_logs.py        # POST /api/frontend-logs — nhận log từ browser, ghi thẳng vào demo_frontend_logs
└── web/                       # React (Vite + TypeScript), chỉ gọi path tương đối "/api/..."
    ├── Dockerfile               # multi-stage: build bằng node, phục vụ dist/ bằng nginx
    ├── nginx.conf                # proxy "/api/*" -> service "api" (Docker network)
    ├── vite.config.ts             # dev server proxy "/api" -> localhost:8000
    └── src/
        ├── main.tsx                 # entrypoint — gọi setupFrontendLogging() trước khi render
        ├── logger.ts                  # bắt window.onerror/unhandledrejection, gửi POST /api/frontend-logs (sendBeacon)
        ├── App.tsx                   # 1 trang duy nhất (không còn tab Monitoring)
        ├── api.ts                     # fetch wrapper: search, categories, seed, simulate
        ├── styles.css                  # theme tối
        └── components/
            └── SearchTab.tsx            # ô tìm kiếm, chip category, kết quả highlight, nút seed/simulate/test lỗi
```

## Lưu ý: endpoint này là Elastic Cloud **Serverless**

Cluster đằng sau endpoint đề bài (`my-security-project-...`) là 1 **Serverless project**, không phải cluster
cổ điển — phát hiện được khi build/test bản đầu của demo này (lúc còn tự code endpoint `/api/monitoring/health`
gọi `_cluster/health`, trước khi chuyển hẳn sang dùng Kibana cho phần monitoring). Trên serverless, Elastic
quản lý hoàn toàn hạ tầng nên nhiều API cấp cluster/node **không khả dụng cho tenant** — nếu bạn tự gọi các API
này (qua Kibana Dev Tools hoặc code riêng), sẽ gặp lỗi `410 api_not_available_exception`:

| API | Cluster cổ điển | Serverless |
|---|---|---|
| `GET /` (`es.info()`) | ✅ | ✅ |
| `GET _cat/indices` | ✅ | ✅ |
| `GET _cluster/health` | ✅ | ❌ 410 `api_not_available_exception` |
| `GET <index>/_stats` | ✅ | ❌ 410 `api_not_available_exception` |

Kibana Discover/Dashboards hoạt động bình thường trên serverless (chúng dùng API nội bộ khác, không phải
`_cluster/health`) — giới hạn trên chỉ ảnh hưởng nếu bạn tự gọi thẳng các API cấp cluster/node.

## Giới hạn của demo

- `demo_logs`/`demo_frontend_logs` là các index đơn, không chia theo ngày (`demo-logs-YYYY.MM.DD`) và không có
  ILM như setup log production thật — xem [backend/database/elasticsearch/README.md#5-lưu-ý-khi-sử-dụng](../../backend/database/elasticsearch/README.md) mục shard sizing để hiểu vì sao production cần chia index theo thời gian.
- Log backend được ghi **fire-and-forget** (`asyncio.create_task`, không `await`) để không làm chậm response —
  nghĩa là nếu app tắt đột ngột ngay sau request, log cuối có thể bị mất. Chấp nhận được cho demo, không phù
  hợp cho audit log cần đảm bảo không mất.
- Không có bước đồng bộ dữ liệu từ DB nguồn (CDC/outbox) như mô tả ở mục 6 của bài học — demo này chỉ tập
  trung vào search + logging, dữ liệu `demo_articles` chỉ seed 1 lần từ file tĩnh.
- `logger.ts` ở frontend chỉ bắt lỗi JS toàn cục (`window.onerror`, `unhandledrejection`) — không tự log mọi
  lệnh `fetch` thất bại hay hành vi user cụ thể; muốn vậy phải tự gọi `logError()`/`logInfo()` thủ công tại chỗ
  cần.
