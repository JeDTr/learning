# Dữ liệu mẫu cho demo full-text search — bài viết ngắn về chủ đề database/backend,
# đồng bộ chủ đề với các note học trong backend/database/ của repo này.

ARTICLES = [
    {
        "id": "1",
        "title": "Redis là gì và khi nào nên dùng làm cache",
        "content": (
            "Redis là in-memory key-value store, nổi bật với tốc độ đọc/ghi cực nhanh nhờ "
            "lưu toàn bộ dữ liệu trong RAM. Dùng phổ biến nhất cho cache-aside pattern: "
            "kiểm tra cache trước, miss thì đọc DB rồi ghi lại cache kèm TTL."
        ),
        "category": "Database",
        "tags": ["redis", "cache", "nosql"],
        "published_at": "2026-01-10T00:00:00Z",
    },
    {
        "id": "2",
        "title": "MongoDB: embed hay reference trong thiết kế schema",
        "content": (
            "Nguyên tắc cốt lõi khi thiết kế document MongoDB: dữ liệu đọc cùng nhau nên "
            "embed vào 1 document, dữ liệu tăng trưởng không giới hạn (như review sản phẩm) "
            "nên tách collection riêng và reference qua ID."
        ),
        "category": "Database",
        "tags": ["mongodb", "nosql", "schema-design"],
        "published_at": "2026-01-15T00:00:00Z",
    },
    {
        "id": "3",
        "title": "Composite index và quy tắc leftmost-prefix trong PostgreSQL",
        "content": (
            "Composite index trên (a, b, c) chỉ tối ưu được cho query lọc theo a, hoặc a+b, "
            "hoặc a+b+c — không tối ưu cho query chỉ lọc theo b hoặc c riêng lẻ. "
            "EXPLAIN ANALYZE là công cụ bắt buộc để xác nhận index có thật sự được dùng."
        ),
        "category": "Database",
        "tags": ["postgresql", "sql", "indexing"],
        "published_at": "2026-01-20T00:00:00Z",
    },
    {
        "id": "4",
        "title": "Elasticsearch: full-text search hoạt động thế nào",
        "content": (
            "Elasticsearch tách văn bản thành token qua analyzer (lowercase, stemming, "
            "loại bỏ dấu câu), xây inverted index để tra cứu theo từ khóa cực nhanh, và "
            "xếp hạng kết quả theo độ liên quan bằng thuật toán BM25."
        ),
        "category": "Database",
        "tags": ["elasticsearch", "search", "lucene"],
        "published_at": "2026-01-25T00:00:00Z",
    },
    {
        "id": "5",
        "title": "Cassandra và mô hình column-family cho dữ liệu ghi nhiều",
        "content": (
            "Cassandra tối ưu cho khối lượng ghi cực lớn, phân tán trên hàng nghìn node, "
            "chấp nhận eventual consistency (tunable) để đổi lấy khả năng scale ngang gần "
            "như vô hạn. Phù hợp cho log, time-series, activity feed quy mô petabyte."
        ),
        "category": "Database",
        "tags": ["cassandra", "nosql", "column-family"],
        "published_at": "2026-02-01T00:00:00Z",
    },
    {
        "id": "6",
        "title": "Neo4j và bài toán truy vấn quan hệ nhiều tầng",
        "content": (
            "Graph database biểu diễn dữ liệu bằng node và edge, tối ưu cho truy vấn "
            "traversal (bạn của bạn của bạn) mà RDBMS phải JOIN rất nhiều lần mới làm được. "
            "Ứng dụng phổ biến: gợi ý kết bạn, fraud detection, knowledge graph."
        ),
        "category": "Database",
        "tags": ["neo4j", "graph-database"],
        "published_at": "2026-02-05T00:00:00Z",
    },
    {
        "id": "7",
        "title": "CAP theorem: vì sao NoSQL phân tán phải đánh đổi",
        "content": (
            "Khi xảy ra network partition, hệ phân tán chỉ có thể chọn ưu tiên Consistency "
            "(chờ đồng bộ, có thể từ chối request) hoặc Availability (luôn trả lời, có thể "
            "trả dữ liệu cũ). MongoDB thiên về CP, Cassandra/DynamoDB thiên về AP."
        ),
        "category": "Architecture",
        "tags": ["cap-theorem", "distributed-systems"],
        "published_at": "2026-02-10T00:00:00Z",
    },
    {
        "id": "8",
        "title": "Change Data Capture: đồng bộ dữ liệu real-time giữa các hệ thống",
        "content": (
            "CDC (qua Debezium) đọc trực tiếp binlog/WAL của database để bắt mọi thay đổi, "
            "kể cả thay đổi không qua application code, rồi đẩy qua Kafka cho các consumer "
            "downstream — cách chuẩn để giữ Elasticsearch/cache đồng bộ với DB chính."
        ),
        "category": "Architecture",
        "tags": ["cdc", "kafka", "debezium"],
        "published_at": "2026-02-15T00:00:00Z",
    },
    {
        "id": "9",
        "title": "Outbox pattern: đảm bảo ghi DB và publish event là atomic",
        "content": (
            "Thay vì ghi DB rồi gọi tiếp message queue (rủi ro lệch nếu bước 2 lỗi), "
            "outbox pattern ghi thêm 1 record event vào cùng transaction với DB, rồi 1 "
            "worker riêng đọc bảng outbox và publish đi — đảm bảo atomicity mà không cần CDC."
        ),
        "category": "Architecture",
        "tags": ["outbox-pattern", "microservices"],
        "published_at": "2026-02-20T00:00:00Z",
    },
    {
        "id": "10",
        "title": "Rate limiting với Redis: sliding window vs fixed window",
        "content": (
            "Fixed window đơn giản nhưng có thể cho phép burst gấp đôi ở ranh giới window. "
            "Sliding window log hoặc sliding window counter chính xác hơn, triển khai bằng "
            "sorted set hoặc Lua script trong Redis để đảm bảo atomic."
        ),
        "category": "Backend",
        "tags": ["redis", "rate-limiting"],
        "published_at": "2026-02-25T00:00:00Z",
    },
    {
        "id": "11",
        "title": "Phân biệt SQL injection và cách phòng chống bằng prepared statement",
        "content": (
            "SQL injection xảy ra khi nối chuỗi trực tiếp input người dùng vào câu query. "
            "Prepared statement (parameterized query) tách biệt code và data, khiến input "
            "độc hại không thể được diễn giải thành câu lệnh SQL."
        ),
        "category": "Backend",
        "tags": ["security", "sql-injection"],
        "published_at": "2026-03-01T00:00:00Z",
    },
    {
        "id": "12",
        "title": "So sánh REST và GraphQL cho thiết kế API",
        "content": (
            "REST đơn giản, cache tốt qua HTTP, nhưng dễ bị over-fetching/under-fetching. "
            "GraphQL cho client tự chọn field cần lấy trong 1 request, đổi lại phức tạp hơn "
            "ở tầng cache và cần cẩn thận với N+1 query ở resolver."
        ),
        "category": "Backend",
        "tags": ["rest", "graphql", "api-design"],
        "published_at": "2026-03-05T00:00:00Z",
    },
    {
        "id": "13",
        "title": "Docker Compose cho môi trường phát triển đa dịch vụ",
        "content": (
            "Docker Compose định nghĩa nhiều service (DB, cache, API) trong 1 file YAML, "
            "healthcheck đảm bảo service phụ thuộc chỉ khởi động sau khi DB sẵn sàng, "
            "tránh lỗi kết nối lúc container mới start."
        ),
        "category": "DevOps",
        "tags": ["docker", "docker-compose"],
        "published_at": "2026-03-10T00:00:00Z",
    },
    {
        "id": "14",
        "title": "Kubernetes: khái niệm Pod, Deployment, Service cơ bản",
        "content": (
            "Pod là đơn vị triển khai nhỏ nhất, Deployment quản lý số lượng replica và "
            "rolling update, Service cung cấp 1 địa chỉ ổn định để truy cập các Pod dù "
            "chúng bị tạo lại hay đổi IP liên tục."
        ),
        "category": "DevOps",
        "tags": ["kubernetes", "container-orchestration"],
        "published_at": "2026-03-15T00:00:00Z",
    },
    {
        "id": "15",
        "title": "Circuit breaker: ngăn lỗi lan truyền trong hệ thống microservices",
        "content": (
            "Khi 1 service downstream liên tục lỗi/timeout, circuit breaker tự động "
            "'mở mạch' để chặn request tiếp tục dội vào service đó, tránh cạn kiệt tài "
            "nguyên toàn hệ thống — sau 1 khoảng thời gian mới thử lại (half-open state)."
        ),
        "category": "Architecture",
        "tags": ["resilience", "microservices"],
        "published_at": "2026-03-20T00:00:00Z",
    },
    {
        "id": "16",
        "title": "Observability: 3 trụ cột Logs, Metrics, Traces",
        "content": (
            "Logs ghi lại sự kiện chi tiết theo thời gian, Metrics là số liệu tổng hợp "
            "theo thời gian (latency, error rate), Traces theo dõi 1 request đi qua nhiều "
            "service. Kết hợp cả 3 mới đủ để debug incident trong hệ thống phân tán."
        ),
        "category": "DevOps",
        "tags": ["observability", "monitoring", "logging"],
        "published_at": "2026-03-25T00:00:00Z",
    },
]
