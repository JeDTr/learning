# Database Learning Notes

## [rdbms/](rdbms/README.md)

RDBMS — use case thực tế (e-commerce, thư viện, đặt phòng khách sạn, mạng xã hội, sổ cái ngân hàng) với ERD, DDL PostgreSQL, ràng buộc, kèm ví dụ FastAPI/Laravel/NestJS.

## [comparisons/](comparisons/README.md)

So sánh RDBMS vs Document vs Key-Value, kèm case study thực tế (ngân hàng, Amazon, Shopee, Lazada) và cách chọn database theo use case.

## [nosql/](nosql/README.md)

Phân loại 4 nhóm NoSQL chính (Key-Value, Document, Column-Family, Graph) — đặc điểm, sản phẩm tiêu biểu, use case, cách chọn loại nào, và lưu ý về CAP theorem.

## [mongodb/](mongodb/README.md)

MongoDB — nguyên tắc embed vs reference, các schema design pattern (Attribute, Subset, Bucket, Outlier, Extended Reference) qua 4 use case thực tế (catalog sản phẩm, blog/CMS, mạng xã hội, IoT time-series), kèm ví dụ Mongoose.

## [sql/](sql/README.md)

SQL nâng cao — bài toán JOIN (LEFT/RIGHT/FULL OUTER/SELF/CROSS), aggregation phức tạp (ROLLUP, FILTER), window functions (RANK, LAG/LEAD, running total), subquery/CTE đệ quy, các bài toán tổng hợp (PIVOT, gaps & islands), và composite index (leftmost-prefix rule chứng minh bằng EXPLAIN ANALYZE thật).

## [redis/](redis/README.md)

Redis — use case thực tế (cache, session, queue, lock...) và kiến thức vận hành nâng cao (config, persistence, replication, cluster...), kèm ví dụ FastAPI/Laravel/NestJS.

## [elasticsearch/](elasticsearch/README.md)

Elasticsearch — kiến trúc (index, shard, replica), tính năng chính, [use-cases/](elasticsearch/use-cases/) so sánh với công cụ khác (Postgres FTS, Algolia, Splunk, Loki, Pinecone...), lưu ý vận hành, và chiến lược đồng bộ dữ liệu (CDC, Outbox) để giữ ES luôn mới nhất/chính xác.
