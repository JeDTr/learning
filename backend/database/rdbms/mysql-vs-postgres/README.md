# MySQL vs PostgreSQL

Cả hai đều là RDBMS mã nguồn mở phổ biến nhất thế giới, cùng hỗ trợ ACID đầy đủ — nhưng khác nhau về kiến trúc, mức độ tuân thủ chuẩn SQL, và hệ sinh thái mở rộng. Note này so sánh sâu giữa 2 engine cụ thể; xem [../../comparisons](../../comparisons/README.md) nếu cần so sánh ở tầng rộng hơn (RDBMS vs Document vs Key-Value).

## 1. Tổng quan kiến trúc

### MySQL

- Kiến trúc **pluggable storage engine** — engine mặc định và phổ biến nhất là **InnoDB** (ACID đầy đủ, MVCC qua undo log, row-level locking). MyISAM (cũ hơn, không transaction) hầu như không còn dùng cho dữ liệu quan trọng.
- Thuộc sở hữu **Oracle Corporation** (từ khi mua Sun Microsystems năm 2010) — có bản Community (GPL, miễn phí) và Enterprise (thương mại). Các fork phổ biến: **MariaDB** (do người sáng lập MySQL lập ra sau vụ Oracle mua lại), **Percona Server**.
- Mô hình xử lý kết nối: **thread-per-connection** — nhẹ hơn, chịu được nhiều kết nối đồng thời tốt hơn khi chưa dùng connection pooler.

### PostgreSQL

- Chỉ **1 storage engine** (không pluggable như MySQL), nhưng bù lại **rất giàu khả năng mở rộng** qua extension (PostGIS cho dữ liệu địa lý, TimescaleDB cho time-series, pg_trgm cho fuzzy search...) và Foreign Data Wrapper (query xuyên nguồn dữ liệu khác).
- Mã nguồn mở hoàn toàn theo **PostgreSQL License** (permissive, tương tự MIT) — không thuộc sở hữu 1 công ty, do cộng đồng **PostgreSQL Global Development Group** phát triển.
- Mô hình xử lý kết nối: **process-per-connection** — tốn tài nguyên hơn khi có hàng nghìn kết nối đồng thời, production thường cần thêm connection pooler (PgBouncer).
- Tuân thủ chuẩn SQL chặt chẽ hơn, kiểu dữ liệu phong phú hơn hẳn (array, range, JSONB, custom type...) — đây cũng là lý do các ví dụ ở [../use-cases](../README.md) dùng nhiều tính năng đặc thù Postgres.

## 2. Bảng so sánh chi tiết

| Tiêu chí | MySQL (InnoDB) | PostgreSQL |
|---|---|---|
| Giấy phép | GPL (Community) + thương mại (Enterprise), thuộc Oracle | PostgreSQL License (permissive), cộng đồng độc lập |
| Cơ chế MVCC | Undo log (giống Oracle) — không cần dọn định kỳ | Lưu nhiều phiên bản row ngay trong bảng — cần `VACUUM` định kỳ dọn dead tuple |
| Mô hình kết nối | Thread-per-connection, nhẹ hơn | Process-per-connection, nặng hơn — production thường cần PgBouncer |
| Kiểu dữ liệu JSON | `JSON` (từ 5.7.8), index qua generated column | `JSONB` (dạng nhị phân, index trực tiếp bằng GIN) — mạnh và linh hoạt hơn |
| Kiểu dữ liệu khác | Chuẩn: int, varchar, decimal... | Phong phú hơn hẳn: `ARRAY`, `RANGE` (`DATERANGE`...), `hstore`, `UUID` native, custom type |
| Full-text search | `FULLTEXT INDEX` (InnoDB từ 5.6) | `tsvector`/`tsquery` — mạnh hơn, hỗ trợ ranking, nhiều ngôn ngữ |
| Window functions, CTE | Có từ MySQL 8.0 (2018) | Có từ lâu, đầy đủ hơn (kể cả recursive CTE) |
| Ràng buộc nâng cao | Không có `EXCLUDE` constraint | `EXCLUDE USING gist` — chống chồng lấn range, xem [use-cases/03-hotel-booking](../use-cases/03-hotel-booking/README.md) |
| Partial index | Không hỗ trợ | Hỗ trợ (`CREATE INDEX ... WHERE ...`), xem [use-cases/02-library-loan](../use-cases/02-library-loan/README.md) |
| Khả năng mở rộng (extension) | Hạn chế, chủ yếu qua storage engine plugin | Rất mạnh: PostGIS, TimescaleDB, pg_trgm, Citus... |
| Replication | Binlog-based (statement/row), Galera Cluster/Group Replication cho multi-master | WAL-based streaming replication, logical replication (từ v10) |
| Sharding tự nhiên | Không có sẵn — cần Vitess hoặc tự viết | Không có sẵn — cần extension Citus hoặc tự viết |
| Hiệu năng OLTP đơn giản, nhiều kết nối | Thường nhanh hơn khi chưa cấu hình pooler | Cần connection pooler mới đạt hiệu năng tương đương ở tải rất cao |
| Độ phức tạp truy vấn hỗ trợ | Khá, cải thiện nhiều từ bản 8.0 | Rất cao — gần như "chuẩn vàng" cho SQL phức tạp |

## 3. Khi nào chọn cái nào

**Chọn MySQL khi**:
- Web app đọc nhiều, ghi đơn giản, cần scale ngang qua công cụ sharding đã trưởng thành (Vitess).
- Team/hạ tầng đã quen hệ sinh thái MySQL/MariaDB (đa số shared hosting, cPanel chỉ có MySQL).
- Ưu tiên nhiều kết nối đồng thời ngay từ đầu mà chưa muốn thêm connection pooler.

**Chọn PostgreSQL khi**:
- Cần kiểu dữ liệu phong phú (JSONB, array, range) và ràng buộc phức tạp (`EXCLUDE`, partial index, check constraint đa dạng) — như các ví dụ ở [../use-cases](../README.md).
- Cần mở rộng qua extension: dữ liệu địa lý (PostGIS), time-series (TimescaleDB), full-text search mạnh.
- Truy vấn phức tạp: window function, recursive CTE, report/analytics ngay trên hệ OLTP.
- Ưu tiên tuân thủ chuẩn SQL chặt chẽ và tính đúng đắn dữ liệu.

## 4. Case study thực tế

> Cùng quy ước độ tin cậy như ở [../../comparisons](../../comparisons/README.md): phân biệt case đã **công bố công khai chính thức** và case **suy luận theo thông lệ ngành**.

**Uber — chuyển từ PostgreSQL sang MySQL (2016)** *(đã công bố công khai, độ tin cậy cao)*:
- Uber Engineering công khai bài viết kỹ thuật "Why Uber Engineering Switched from Postgres to MySQL", giải thích lý do chính: cần connection handling ổn định hơn ở quy mô cực lớn, cơ chế MVCC của Postgres thời điểm đó khiến `UPDATE` 1 cột phải ghi lại **toàn bộ index** của row (kể cả index không liên quan đến cột vừa đổi), trong khi InnoDB chỉ cập nhật các secondary index thực sự liên quan — gây write amplification lớn ở khối lượng ghi cao của Uber.
- Đây là ví dụ kinh điển cho thấy lựa chọn DB phụ thuộc **đặc thù workload và phiên bản DB tại thời điểm quyết định**, không phải "MySQL tốt hơn Postgres tuyệt đối" — nhiều hạn chế Uber nêu đã được PostgreSQL cải thiện ở các bản sau.

**Facebook/Meta — MySQL ở quy mô cực lớn** *(đã công bố công khai)*:
- Facebook là một trong những đơn vị vận hành MySQL lớn nhất thế giới, tự phát triển **MyRocks** (storage engine dựa trên RocksDB, thay thế InnoDB) để tối ưu nén dữ liệu và throughput ghi, đã mã nguồn mở công khai.

**YouTube, Pinterest, Slack, GitHub — MySQL + sharding qua Vitess** *(đã công bố công khai)*:
- YouTube tự phát triển **Vitess** (hệ thống sharding/scale ngang cho MySQL) để chịu tải video khổng lồ, sau đó open-source và trở thành dự án CNCF; nhiều công ty khác (Pinterest, Slack, GitHub) cũng dùng Vitess cho hạ tầng MySQL của họ.

**Instagram — PostgreSQL ở quy mô lớn** *(đã công bố công khai)*:
- Instagram Engineering công khai chi tiết cách họ sharding PostgreSQL (partition theo `user_id`, tự sinh ID kiểu tương tự Twitter Snowflake) để scale từ hàng triệu đến hàng tỷ bản ghi mà vẫn giữ Postgres làm database chính.

**Apple — sử dụng PostgreSQL nội bộ rộng rãi** *(theo phát biểu công khai tại hội nghị PostgreSQL, độ tin cậy trung bình — Apple không công bố kiến trúc đầy đủ)*:
- Apple là một trong những nhà tài trợ/đóng góp lớn cho cộng đồng PostgreSQL, được biết đến rộng rãi là dùng Postgres cho nhiều hệ thống nội bộ.

### 4.1 Fintech / Ngân hàng số

**Lưu ý phân biệt quan trọng**: đây là các **ứng dụng fintech/ngân hàng số** (Robinhood, Coinbase, Square...) — khác hẳn **core banking truyền thống** (Vietcombank, DBS, Capital One...) đã nêu ở [../../comparisons](../../comparisons/README.md#41-ngành-ngân-hàng--giao-dịch-tài-chính). Core banking gần như luôn chạy trên **Oracle Database** vì ràng buộc vendor phần mềm lõi (Temenos T24, Oracle FLEXCUBE được chứng nhận/certified chạy trên Oracle) — cuộc so sánh MySQL vs Postgres hầu như không xảy ra ở lớp core banking, mà chủ yếu ở các công ty fintech xây hệ thống từ đầu, không bị ràng buộc vendor.

**Nghiêng PostgreSQL**:
- **Robinhood** *(đã công bố công khai, độ tin cậy cao)* — dùng PostgreSQL cho hệ thống giao dịch. Trong sự kiện GameStop/AMC (tháng 1/2021), Robinhood và báo chí công nghệ đưa tin rộng rãi về sự cố liên quan tải cực cao trên PostgreSQL, gián tiếp xác nhận Postgres là database giao dịch lõi của họ thời điểm đó.
- **Coinbase** *(đã công bố công khai)* — kỹ sư Coinbase từng chia sẻ tại các hội nghị công nghệ/PostgreSQL về cách vận hành Postgres ở quy mô lớn cho hệ thống giao dịch crypto.
- **GoCardless** (fintech thanh toán định kỳ, châu Âu) *(đã công bố công khai)* — blog kỹ thuật công khai nhiều bài chi tiết về vận hành PostgreSQL, gồm cả zero-downtime schema migration.

**Nghiêng MySQL**:
- **Square (nay là Block)** *(đã công bố công khai)* — Square Engineering blog công khai kiến trúc sharding MySQL bằng **Vitess** (cùng công nghệ YouTube dùng) cho hệ thống thanh toán quy mô lớn.

### 4.2 Thương mại điện tử (bổ sung riêng cho MySQL vs Postgres)

Case study Amazon/Shopee/Lazada ở [../../comparisons](../../comparisons/README.md#42-thương-mại-điện-tử--amazon-shopee-lazada) đã nói chung về RDBMS/Document/Key-Value. Ở đây tập trung cụ thể MySQL vs Postgres:

**Nghiêng MySQL**:
- **Shopify** *(đã công bố công khai, độ tin cậy cao)* — Shopify Engineering blog nhiều năm liền công khai chi tiết kiến trúc sharding MySQL (hàng chục nghìn shard) để chịu tải các đợt sale lớn (Black Friday/Cyber Monday).
- **Etsy** *(đã công bố công khai)* — lâu năm là MySQL shop, nhiều bài blog kỹ thuật kinh điển về vận hành/observability trên nền MySQL.

**Nghiêng PostgreSQL**:
- **Zalando** (thương mại điện tử thời trang lớn nhất châu Âu) *(đã công bố công khai, độ tin cậy cao)* — Zalando là nhà đóng góp/tài trợ lớn cho PostgreSQL, tự phát triển **Patroni** (công cụ HA cho Postgres được dùng rộng rãi toàn ngành, không riêng Zalando) để vận hành hàng trăm cluster Postgres cho toàn bộ hệ thống thương mại điện tử của họ.

**Kết luận riêng cho 2 ngành này**: không có xu hướng tuyệt đối ở cả fintech lẫn e-commerce — lựa chọn nghiêng theo ưu tiên kỹ thuật của từng công ty (Shopify/Etsy/Square ưu tiên hệ sinh thái sharding MySQL trưởng thành; Robinhood/Coinbase/Zalando ưu tiên kiểu dữ liệu và ràng buộc phong phú của Postgres, chấp nhận tự đầu tư công cụ vận hành).

## 5. Tóm tắt

- Cả 2 đều là RDBMS ACID đầy đủ, đủ tốt cho phần lớn ứng dụng — khoảng cách tính năng đã thu hẹp nhiều từ khi MySQL 8.0 thêm window function và CTE.
- Chọn **PostgreSQL** khi cần độ đúng chuẩn SQL cao, kiểu dữ liệu/ràng buộc phong phú — đúng như nhiều [use-case](../README.md) trong note này dựa vào tính năng chỉ Postgres mới có (`EXCLUDE`, `DATERANGE`, partial index, recursive CTE).
- Chọn **MySQL** khi cần hệ sinh thái sharding trưởng thành (Vitess), hosting phổ biến, hoặc tổ chức đã đầu tư sâu vào MySQL/MariaDB.
- Ở quy mô lớn, lựa chọn thường phụ thuộc **đặc thù workload và thời điểm quyết định** hơn là "cái nào tốt hơn tuyệt đối" — case Uber là minh chứng rõ nhất.
