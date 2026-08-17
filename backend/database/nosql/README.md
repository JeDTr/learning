# Các loại NoSQL Database

NoSQL ("Not Only SQL") không phải là **1 loại database** mà là một **họ các mô hình dữ liệu** ra đời để giải quyết những gì RDBMS truyền thống làm không tốt: scale ngang dễ dàng, schema linh hoạt, và tốc độ cao cho khối lượng dữ liệu khổng lồ — đánh đổi lại thường là ACID yếu hơn và khả năng query/join hạn chế hơn.

Tài liệu này phân loại **4 nhóm NoSQL chính** theo mô hình dữ liệu, cộng thêm vài nhóm chuyên dụng đáng chú ý. Xem thêm [../comparisons/README.md](../comparisons/README.md) để so sánh sâu RDBMS vs Document vs Key-Value kèm case study thực tế, và [../redis/README.md](../redis/README.md) cho ví dụ chi tiết về Key-Value store.

## 1. Bốn nhóm NoSQL chính

### 1.1 Key-Value Store

Mô hình đơn giản nhất: mỗi bản ghi là 1 cặp `key -> value`, value là blob mà DB không quan tâm cấu trúc bên trong (ứng dụng tự serialize/deserialize).

- **Đặc điểm**: tra cứu theo key cực nhanh (thường O(1)), không hỗ trợ query theo nội dung value (trừ khi DB có thêm cấu trúc mở rộng), scale ngang cực tốt (partition theo key/hash).
- **Sản phẩm tiêu biểu**: Redis, Amazon DynamoDB, Memcached, etcd, Riak.
- **Use case**: cache, session store, feature flag, rate limiting, counter thời gian thực. Xem chi tiết ở [../redis/use-cases/](../redis/use-cases/).

```
GET user:1001:session   -> "{\"userId\":1001,\"expiresAt\":...}"
SET cart:1001           -> "[{\"sku\":\"A1\",\"qty\":2}]"
```

### 1.2 Document Database

Dữ liệu lưu dạng **document** (thường JSON/BSON/XML), mỗi document có thể chứa object/array lồng nhau — không cần join để lấy dữ liệu liên quan.

- **Đặc điểm**: schema linh hoạt (document trong cùng 1 collection không bắt buộc giống cấu trúc), query theo field bên trong document (kèm index), ACID chủ yếu ở cấp 1 document (MongoDB 4.0+ có multi-document transaction nhưng hiệu năng kém hơn nhiều).
- **Sản phẩm tiêu biểu**: MongoDB, Couchbase, Firestore, Amazon DocumentDB.
- **Use case**: catalog sản phẩm (thuộc tính khác nhau theo ngành hàng), CMS, profile người dùng, dữ liệu bán cấu trúc thay đổi thường xuyên.

```json
{
  "_id": "p001",
  "name": "Áo thun",
  "attributes": { "size": ["S", "M", "L"], "color": "đen" },
  "reviews": [{ "user": "u1", "rating": 5 }]
}
```

### 1.3 Column-Family / Wide-Column Store

Dữ liệu tổ chức theo **hàng (row key) và nhóm cột (column family)**, nhưng mỗi hàng có thể có số lượng cột khác nhau — khác RDBMS ở chỗ không bắt buộc mọi hàng cùng schema cột. Tối ưu cho việc ghi/đọc khối lượng cực lớn, phân tán trên nhiều node.

- **Đặc điểm**: scale ngang cực tốt (thiết kế cho hàng petabyte, hàng nghìn node), tối ưu cho ghi nhiều (write-heavy), query chủ yếu theo row key/partition key (không hỗ trợ `JOIN`, aggregate phức tạp yếu), consistency thường là **eventual** (tunable trong Cassandra).
- **Sản phẩm tiêu biểu**: Apache Cassandra, HBase, Google Bigtable, ScyllaDB.
- **Use case**: dữ liệu time-series/log quy mô lớn, hệ thống ghi nhiều đọc theo key (tin nhắn, activity feed, IoT sensor data). Ví dụ nổi tiếng: Facebook dùng Cassandra ban đầu cho Inbox Search; Netflix dùng Cassandra cho dữ liệu viewing history quy mô hàng trăm triệu user.

```
Row key: user123
  Column family "profile":   name="An", age=30
  Column family "activity":  2026-08-01="login", 2026-08-02="purchase"
```

### 1.4 Graph Database

Dữ liệu là **node (thực thể) và edge (quan hệ)** có thuộc tính riêng — tối ưu cho việc truy vấn các quan hệ nhiều tầng (traversal) mà RDBMS phải `JOIN` rất nhiều lần mới làm được.

- **Đặc điểm**: truy vấn quan hệ sâu (bạn của bạn của bạn...) nhanh vì đi theo con trỏ thay vì join bảng; không tối ưu cho aggregate trên toàn bộ dữ liệu (kiểu "tổng doanh thu theo tháng").
- **Sản phẩm tiêu biểu**: Neo4j, Amazon Neptune, ArangoDB (multi-model).
- **Use case**: mạng xã hội (gợi ý kết bạn, tìm đường đi ngắn nhất giữa 2 người), hệ thống gợi ý (recommendation), phát hiện gian lận (fraud detection — tìm vòng lặp giao dịch bất thường), quản lý tri thức (knowledge graph). Ví dụ: Facebook xây riêng **TAO** (graph store nội bộ) để phục vụ social graph ở quy mô hàng tỷ node/edge.

```
(An)-[:FOLLOWS]->(Binh)-[:FOLLOWS]->(Chi)
(An)-[:LIKES]->(Post123)
```

## 2. Bảng so sánh 4 nhóm chính

| Tiêu chí | Key-Value | Document | Column-Family | Graph |
|---|---|---|---|---|
| Mô hình dữ liệu | Key → value (blob) | Document JSON/BSON lồng nhau | Row key + column family | Node + edge có thuộc tính |
| Schema | Không có | Linh hoạt | Linh hoạt theo hàng | Linh hoạt |
| Query mạnh nhất ở | Tra cứu theo key | Filter/index theo field | Đọc/ghi theo row key quy mô lớn | Truy vấn quan hệ nhiều tầng |
| Join | Không | Không (nhúng dữ liệu thay vì join) | Không | Có (traversal thay cho join) |
| Scale ngang | Rất tốt | Tốt | Cực tốt (petabyte-scale) | Khó hơn 3 loại kia |
| Consistency phổ biến | Eventual (tunable) | Strong ở 1 node | Eventual (tunable) | Thường strong ở 1 instance |
| Ví dụ sản phẩm | Redis, DynamoDB | MongoDB, Couchbase | Cassandra, HBase, Bigtable | Neo4j, Neptune |
| Use case điển hình | Cache, session, counter | Catalog, CMS, profile | Log/IoT quy mô lớn, activity feed | Social graph, recommendation, fraud detection |

## 3. Các nhóm chuyên dụng khác

Ngoài 4 nhóm cốt lõi trên, một số hệ thống chuyên dụng cũng thường được xếp vào "NoSQL" theo nghĩa rộng (không phải RDBMS quan hệ truyền thống):

- **Search Engine** (Elasticsearch, OpenSearch, Solr) — tối ưu full-text search, filter/aggregate phức tạp trên dữ liệu lớn. Thường dùng **kèm** DB chính, không thay thế hoàn toàn (đồng bộ dữ liệu từ DB nguồn sang index tìm kiếm).
- **Time-Series Database** (InfluxDB, TimescaleDB, Prometheus) — tối ưu cho dữ liệu gắn timestamp, ghi liên tục theo thời gian (metric hệ thống, dữ liệu cảm biến IoT), hỗ trợ downsampling/retention policy theo thời gian.
- **Vector Database** (Pinecone, Milvus, Weaviate, pgvector) — lưu và tìm kiếm theo **độ tương đồng vector** (embedding), nền tảng cho các ứng dụng AI/semantic search/RAG.
- **Ledger Database** (Amazon QLDB) — sổ cái bất biến (append-only, cryptographically verifiable), dùng khi cần audit trail tuyệt đối nhưng không cần độ phức tạp của blockchain.

Các nhóm này thường **bổ sung** cho 4 nhóm chính ở trên trong một hệ thống polyglot persistence, chứ hiếm khi đứng một mình.

## 4. Khung chọn loại NoSQL nào

```
Dữ liệu chủ yếu là quan hệ phức tạp nhiều tầng
(vd: mạng xã hội, gợi ý, fraud detection)?
│
├── CÓ → Graph Database
│
└── KHÔNG
    │
    ├── Cần ghi/đọc khối lượng cực lớn (petabyte, hàng nghìn node),
    │   chủ yếu theo 1 key, chấp nhận eventual consistency?
    │   → Column-Family (Cassandra, Bigtable)
    │
    ├── Dữ liệu có cấu trúc lồng nhau, thay đổi linh hoạt,
    │   cần query theo field nhưng không cần join phức tạp?
    │   → Document Database
    │
    └── Chỉ cần tra cứu cực nhanh theo 1 key, dữ liệu nhỏ/vừa,
        chấp nhận mất mát nếu crash hoặc có thể tái tạo?
        → Key-Value Store
```

Xem thêm khung quyết định đầy đủ (bao gồm cả RDBMS) ở [../comparisons/README.md](../comparisons/README.md#3-khung-quyết-định--chọn-loại-nào-khi-nào).

## 5. Lưu ý về CAP Theorem

Hầu hết NoSQL phân tán (Cassandra, DynamoDB, MongoDB khi sharded...) đều phải đánh đổi theo **CAP theorem**: khi xảy ra network partition (P — luôn phải chấp nhận trong hệ phân tán), chỉ có thể chọn ưu tiên **Consistency** (mọi node thấy dữ liệu mới nhất, có thể phải chờ/từ chối request) hoặc **Availability** (luôn trả lời, nhưng có thể trả dữ liệu cũ).

- Thiên về **CP**: MongoDB (mặc định), HBase.
- Thiên về **AP**: Cassandra, DynamoDB (mặc định, nhưng có tuỳ chọn strong consistency cho từng read).

Đây là lý do "NoSQL không có ACID" là hiểu chưa đủ — chính xác hơn là **NoSQL cho phép đánh đổi consistency lấy availability/tốc độ khi cần**, còn RDBMS mặc định chọn strong consistency.

## 6. Tóm tắt

- **Key-Value**: nhanh nhất, đơn giản nhất — cache, session, counter.
- **Document**: linh hoạt nhất cho dữ liệu bán cấu trúc — catalog, CMS, profile.
- **Column-Family**: scale ghi khủng nhất — log, IoT, activity feed quy mô petabyte.
- **Graph**: mạnh nhất cho quan hệ nhiều tầng — social graph, recommendation, fraud detection.
- Hệ thống lớn thực tế luôn kết hợp nhiều loại (polyglot persistence) — xem case study Amazon/Shopee ở [../comparisons/README.md](../comparisons/README.md#4-case-study-thực-tế).
