# Elasticsearch

Elasticsearch là một **search & analytics engine phân tán**, xây dựng trên nền **Apache Lucene**. Nó không phải database quan hệ hay document database theo nghĩa "nguồn sự thật" (source of truth) — mục đích chính là **index dữ liệu để tìm kiếm/aggregate cực nhanh trên khối lượng lớn**, thường đứng **cạnh** một DB chính (Postgres, MongoDB...) chứ không thay thế nó.

Bộ 3 công cụ Elastic (Elasticsearch + Logstash/Beats + Kibana) thường gọi chung là **ELK Stack**. Từ 2021, AWS/nhiều bên fork ra **OpenSearch** (tương thích API) sau tranh cãi bản quyền license của Elastic.

## 1. Kiến trúc cơ bản

| Khái niệm | Tương đương RDBMS | Ghi chú |
|---|---|---|
| Index | Database/Table | Tập hợp document cùng loại, có mapping (schema) riêng |
| Document | Row | 1 bản ghi JSON |
| Field | Column | Có kiểu dữ liệu (`text`, `keyword`, `date`, `geo_point`, `dense_vector`...) |
| Mapping | Schema | Định nghĩa field + cách analyze/index |
| Shard | Partition | 1 index chia thành N shard (Lucene index con), phân tán trên các node |
| Replica | — | Bản sao của shard, phục vụ failover + đọc song song |

```
Cluster
 └─ Node 1, Node 2, Node 3...
     └─ Index "products"
         ├─ Shard 0 (primary) ── Replica (trên node khác)
         └─ Shard 1 (primary) ── Replica (trên node khác)
```

Khi ghi 1 document, ES route nó vào 1 shard theo hash của `_id`. Khi query, request được **scatter** ra tất cả shard liên quan rồi **gather** kết quả lại — đây là cơ chế giúp ES scale ngang tốt cho cả write lẫn read.

## 2. Các tính năng chính

- **Full-text search**: tokenize + analyze text (lowercase, stemming, stopword...) để tìm theo *ý nghĩa* từ chứ không chỉ khớp chuỗi (`LIKE '%...%'`). Hỗ trợ fuzzy match (sai chính tả), synonym, đa ngôn ngữ (kể cả tiếng Việt qua analyzer tùy chỉnh).
- **Relevance scoring**: xếp hạng kết quả theo độ liên quan (thuật toán **BM25**), có thể tùy chỉnh boost theo field/business logic (vd: sản phẩm còn hàng ưu tiên hơn).
- **Aggregation framework**: tính toán thống kê (sum, avg, histogram, terms bucket, nested aggregation...) trên hàng triệu document trong vài trăm ms — mạnh hơn nhiều so với `GROUP BY` truyền thống khi dữ liệu lớn và cần real-time.
- **Near real-time**: document search được (gần như) ngay sau khi index (mặc định refresh mỗi 1s), khác với batch indexing của các search engine cũ.
- **Horizontal scalability**: thêm node là tự động rebalance shard, không cần downtime.
- **Geo search**: query theo khoảng cách, bounding box, polygon (`geo_point`, `geo_shape`).
- **Vector search / kNN**: từ version 8.x hỗ trợ `dense_vector` + approximate kNN — dùng cho semantic search, RAG (kết hợp full-text + vector = "hybrid search").
- **RESTful API**: mọi thao tác (index, query, quản trị cluster) đều qua HTTP + JSON, dễ tích hợp.
- **Schema linh hoạt nhưng có mapping**: có thể dynamic mapping (tự đoán kiểu field) hoặc định nghĩa explicit mapping để kiểm soát cách analyze.

## 3. [use-cases/](use-cases/) — Use case thực tế, so sánh với công cụ khác

Mỗi use case có phân tích riêng kèm bảng so sánh Elasticsearch với các giải pháp thay thế.

1. [Tìm kiếm sản phẩm / nội dung (site search)](use-cases/01-product-search/README.md) — so với Postgres FTS, Algolia, Meilisearch/Typesense, Solr.
2. [Log management / Observability](use-cases/02-log-management/README.md) — so với Splunk, Grafana Loki, Datadog.
3. [Security analytics / SIEM](use-cases/03-security-siem/README.md) — so với Splunk Enterprise Security, IBM QRadar.
4. [E-commerce: search + facet filter](use-cases/04-ecommerce-facet-search/README.md) — case Shopee/Lazada, so với query RDBMS trực tiếp.
5. [Vector search / RAG (semantic search)](use-cases/05-vector-search-rag/README.md) — so với Pinecone/Weaviate/Milvus, pgvector.

## 4. Khi nào KHÔNG nên dùng Elasticsearch

- Cần **source of truth** với ACID/transaction mạnh → dùng RDBMS, đồng bộ dữ liệu sang ES chỉ để search (pattern phổ biến: Postgres/MongoDB là DB chính, ES là "search index" đồng bộ qua CDC/queue).
- Dataset nhỏ, query đơn giản → Postgres FTS hoặc thậm chí `LIKE` là đủ, tránh over-engineering.
- Chỉ cần key-value lookup cực nhanh → Redis phù hợp hơn nhiều.
- Đội ngũ nhỏ, không có ai vận hành cluster (JVM heap, shard rebalancing, garbage collection tuning) → cân nhắc bản managed (Elastic Cloud, AWS OpenSearch Service) hoặc dùng Algolia/Typesense.

## 5. Lưu ý khi sử dụng

### 5.1 ES không phải nguồn sự thật (source of truth)

Luôn phải có 1 DB chính đứng sau (Postgres/MongoDB...) chứa dữ liệu gốc. Nếu mất index ES, phải **reindex lại từ DB chính** — không được lưu dữ liệu nào chỉ tồn tại duy nhất trong ES. Coi ES như 1 "bản sao được tối ưu để search", không phải kho lưu trữ chính.

### 5.2 "Near real-time", không phải real-time tuyệt đối

Mặc định document chỉ **search được sau khi refresh** (chu kỳ 1s) — ghi xong đọc lại ngay lập tức trong vài chục ms đầu có thể chưa thấy. Nếu cần đọc ngay sau ghi (hiếm khi cần), dùng `?refresh=wait_for`, nhưng đừng lạm dụng vì mỗi lần refresh tốn tài nguyên (tạo Lucene segment mới) — refresh liên tục giết throughput ghi.

### 5.3 Mapping gần như bất biến

Không thể đổi **kiểu dữ liệu** của field đã tồn tại (vd: `text` → `keyword`) trên index đang chạy — phải tạo index mới với mapping đúng rồi **reindex** toàn bộ dữ liệu (`_reindex` API), sau đó chuyển alias sang index mới. Vì vậy nên dùng **alias** trỏ tới index thật ngay từ đầu (`products` → `products_v1`) để đổi version không cần sửa code ứng dụng.

### 5.4 Shard sizing — tránh oversharding

Mỗi shard là 1 Lucene index riêng, tốn overhead (memory, file handle) kể cả khi rỗng. Tạo quá nhiều shard nhỏ (vd: mỗi ngày 1 index x nhiều shard cho log ít dữ liệu) làm cluster chậm và tốn RAM quản lý metadata. Nguyên tắc chung: mỗi shard nên **10–50GB**, và tính trước số shard cần thiết vì **không thể tăng số shard của 1 index sau khi tạo** (phải reindex sang index mới với `_split`/`_shrink` API).

### 5.5 Deep pagination bị giới hạn

`from` + `size` mặc định giới hạn tối đa **10,000 kết quả** (`index.max_result_window`) — không dùng để phân trang sâu hoặc export dữ liệu lớn. Dùng **`search_after`** (phân trang tuần tự theo giá trị sort cuối) hoặc **Point-in-Time (PIT) + `search_after`** khi cần duyệt/export toàn bộ dataset lớn.

### 5.6 Tài nguyên & vận hành

- **JVM heap**: đặt tối đa ~50% RAM của node, không vượt quá ~32GB (giới hạn compressed OOP của JVM) — heap quá lớn không giúp nhanh hơn mà còn làm GC pause lâu hơn.
- **Bảo mật**: các bản Elasticsearch cũ (trước 8.x) mặc định **không bật auth/TLS** — nếu expose ra ngoài mà quên bật `xpack.security`, cluster hoàn toàn public. Từ 8.x mặc định đã bật, nhưng vẫn cần tự cấu hình role/API key đúng phạm vi.
- **Backup**: dùng **snapshot** (chụp trạng thái index, lưu ra S3/GCS/NFS...), không có point-in-time recovery theo transaction như RDBMS — mất dữ liệu giữa 2 lần snapshot là mất thật, nên backup thường không phải lo lắng chính vì luôn reindex lại được từ DB nguồn.
- **Version compatibility**: client library (vd: `elasticsearch-py`, `@elastic/elasticsearch`) cần khớp version chính với cluster — nhảy version cluster lớn (vd: 7.x → 8.x) thường có breaking change, nên đọc kỹ migration guide trước khi upgrade.
- **Elastic Cloud Serverless không có API cấp cluster/node**: nếu dùng Elastic Cloud **Serverless** (khác cluster cổ điển/self-managed), các API như `_cluster/health`, `<index>/_stats` trả lỗi `410 api_not_available_exception` — Elastic quản lý hạ tầng hoàn toàn nên tenant không thấy khái niệm node/shard nữa. Dùng `GET /` (cluster info) + `_cat/indices` thay thế để lấy version/health/docs-size từng index. Gặp thực tế ở [demos/elasticsearch-demo](../../../demos/elasticsearch-demo/README.md) — code viết theo cluster cổ điển chạy thẳng vào serverless sẽ lỗi 410 ngay ở bước health check.

## 6. Đồng bộ dữ liệu: đảm bảo luôn mới nhất & chính xác

Đây là bài toán trung tâm khi ES đóng vai trò "index phụ" bên cạnh DB chính: **làm sao mọi thay đổi ở DB nguồn đều phản ánh đúng và kịp thời sang ES**, mà không double-write sai lệch hay bỏ sót sự kiện.

### 6.1 Các chiến lược đồng bộ, từ đơn giản đến chuẩn production

| Chiến lược | Cách làm | Ưu điểm | Rủi ro |
|---|---|---|---|
| **Dual write** | App code ghi DB xong thì gọi tiếp ES client để index | Đơn giản, dễ implement nhất | Không atomic giữa 2 hệ thống khác nhau — ghi DB thành công nhưng ES lỗi (network, timeout) là **lệch dữ liệu ngay lập tức**, và không có cách nào tự phát hiện |
| **Outbox pattern** | Trong cùng transaction ghi DB, ghi thêm 1 row vào bảng `outbox` (event). 1 worker riêng đọc `outbox` theo thứ tự rồi đẩy sang ES, đánh dấu đã xử lý | Atomic ở tầng DB (transaction đảm bảo), không cần hạ tầng CDC phức tạp | Cần tự xây worker + xử lý retry/idempotency, thêm độ trễ nhỏ (polling outbox) |
| **CDC (Change Data Capture)** — Debezium đọc binlog (MySQL)/WAL (Postgres) → Kafka → consumer index vào ES | Capture **mọi** thay đổi ở tầng storage engine, kể cả thay đổi không qua app (batch job, sửa DB trực tiếp, migration) | Chuẩn nhất cho hệ thống lớn, tách rời hoàn toàn khỏi app logic, replay lại được từ Kafka nếu ES lỗi | Thêm thành phần hạ tầng (Kafka, Debezium connector), độ phức tạp vận hành cao hơn |
| **Batch reindex định kỳ** | Cron job so sánh `updated_at` hoặc reindex toàn bộ theo lịch (vd: mỗi đêm) | Đơn giản, hoạt động như "lưới an toàn" bắt các bản ghi bị miss bởi cơ chế real-time | Không real-time — chỉ nên dùng **kèm** 1 trong 3 cách trên, không thay thế hoàn toàn |

**Khuyến nghị**: dùng **CDC** (hoặc Outbox nếu chưa muốn thêm Kafka) làm cơ chế chính, cộng thêm **batch reindex định kỳ** làm lưới an toàn để tự sửa các sai lệch nhỏ theo thời gian — không dựa 100% vào dual write cho dữ liệu quan trọng.

### 6.2 Đảm bảo chính xác khi có nhiều event đến không theo thứ tự

- **Idempotency**: dùng chính ID của bản ghi ở DB nguồn làm `_id` trong ES, và dùng **upsert** (`index` API ghi đè theo `_id`, không phải `create`) — xử lý lại cùng 1 event nhiều lần (do retry) không tạo dữ liệu trùng hay sai.
- **Optimistic concurrency control**: khi 2 event của cùng 1 document tới không đúng thứ tự (network delay), dùng `_seq_no` + `_primary_term` khi update để ES tự chối ghi đè bản mới bằng bản cũ hơn — tránh tình trạng "event cũ tới sau" làm dữ liệu tụt lùi.
- **Xử lý xoá (DELETE)**: dễ bị bỏ sót nhất — nếu chỉ đồng bộ theo `updated_at` (batch reindex), record đã bị xoá ở DB nguồn sẽ **không bao giờ được xoá khỏi ES** vì query `WHERE updated_at > last_sync` không còn thấy nó. CDC giải quyết tốt vì bắt được sự kiện `DELETE` trực tiếp từ binlog/WAL; nếu dùng batch, cần thêm bước dò record "mồ côi" (tồn tại ở ES nhưng không còn ở DB) để xoá.

### 6.3 Giám sát độ trễ & tính đúng đắn

- Theo dõi **consumer lag** (nếu dùng Kafka/CDC) — lag tăng bất thường nghĩa là ES đang tụt lại so với DB.
- Định kỳ **đối soát** (reconciliation): so sánh `COUNT(*)` hoặc checksum giữa DB nguồn và ES theo từng khoảng thời gian/partition, cảnh báo khi lệch vượt ngưỡng.
- Với dữ liệu nhạy cảm về độ chính xác (giá, tồn kho), cân nhắc **đọc trực tiếp từ DB chính** cho phần hiển thị số liệu quan trọng (giá, số lượng còn hàng) ngay tại trang chi tiết, còn ES chỉ phục vụ tìm kiếm/liệt kê — tránh user thấy giá cũ do độ trễ đồng bộ.

## 7. Tóm tắt

- Elasticsearch = search + analytics engine phân tán trên Lucene, mạnh nhất ở **full-text search kết hợp aggregation** trên dữ liệu lớn, gần real-time.
- Luôn đi kèm vai trò "index phụ" bên cạnh DB chính, hiếm khi là nguồn sự thật duy nhất.
- So với đối thủ: mạnh hơn Postgres FTS ở scale lớn + tuning sâu, rẻ hơn Splunk ở log/SIEM, tự host được (khác Algolia), và giờ hỗ trợ cả vector search cho use case AI/RAG.
- Đánh đổi: chi phí vận hành cluster, cần tự thiết kế mapping/analyzer/shard sizing đúng thì mới phát huy hết hiệu năng.
- Đồng bộ dữ liệu là bài toán quan trọng nhất khi vận hành thực tế — ưu tiên **CDC/Outbox** làm cơ chế chính, **batch reindex** làm lưới an toàn, và luôn xử lý riêng trường hợp **xoá dữ liệu**.
