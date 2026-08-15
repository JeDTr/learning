# RDBMS vs Document vs Key-Value

So sánh 3 mô hình dữ liệu phổ biến nhất, kèm case study thực tế để biết **khi nào chọn loại nào**.

> **Lưu ý về độ tin cậy thông tin**: Các case study bên dưới được chia làm 2 nhóm — (1) **đã được công bố công khai chính thức** (blog kỹ thuật, hội nghị, báo cáo tài chính...) và (2) **suy luận theo thông lệ ngành** khi công ty không công bố chi tiết hạ tầng (đặc biệt với ngân hàng — vì lý do bảo mật, hầu như không ngân hàng nào công bố chi tiết database họ dùng). Mỗi ví dụ đều ghi rõ nguồn thuộc nhóm nào.

## 1. Tổng quan 3 mô hình dữ liệu

### RDBMS (Relational Database — MySQL, PostgreSQL, Oracle, SQL Server)

- Dữ liệu tổ chức thành **bảng (table)** với **schema cố định** (khai báo trước kiểu dữ liệu từng cột).
- Quan hệ giữa các bảng qua **foreign key**, truy vấn bằng SQL, hỗ trợ `JOIN` mạnh.
- **ACID đầy đủ** (Atomicity, Consistency, Isolation, Durability) — transaction đảm bảo tuyệt đối, không có trạng thái "nửa vời".
- Scale chủ yếu theo chiều dọc (vertical — tăng CPU/RAM của 1 máy); scale ngang (sharding) khó và cần thiết kế cẩn thận, hoặc dùng biến thể NewSQL (CockroachDB, Google Spanner, TiDB, OceanBase).

### Document Database (MongoDB, Couchbase, Firestore)

- Dữ liệu lưu dạng **document** (thường là JSON/BSON) — 1 document có thể chứa dữ liệu lồng nhau (nested object, array) mà không cần join.
- **Schema linh hoạt** — các document trong cùng 1 collection không bắt buộc giống cấu trúc nhau, dễ thay đổi khi nghiệp vụ thay đổi.
- ACID thường chỉ đảm bảo ở **cấp độ 1 document** (MongoDB từ bản 4.0+ có hỗ trợ multi-document transaction nhưng hiệu năng kém hơn nhiều so với single-document).
- Scale ngang (horizontal) dễ hơn RDBMS truyền thống nhờ thiết kế hướng tới sharding ngay từ đầu.

### Key-Value Store (Redis, DynamoDB, Memcached)

- Mô hình đơn giản nhất: mỗi bản ghi là 1 cặp `key -> value`, value thường là blob không có cấu trúc mà DB "nhìn thấy" được (ứng dụng tự serialize/deserialize).
- **Không hỗ trợ query theo nội dung bên trong value** — chỉ tra cứu chính xác theo key (một số như Redis có thêm cấu trúc dữ liệu đặc biệt: Hash, Set, Sorted Set để mở rộng khả năng truy vấn).
- Tốc độ đọc/ghi **cực nhanh** (đặc biệt khi in-memory như Redis), scale ngang rất tốt (partition theo key).
- Đánh đổi: gần như không có khả năng truy vấn phức tạp, không có join, transaction giới hạn.

## 2. Bảng so sánh chi tiết

| Tiêu chí | RDBMS | Document | Key-Value |
|---|---|---|---|
| Mô hình dữ liệu | Bảng, hàng, cột | Document (JSON/BSON) lồng nhau | Cặp key-value đơn giản |
| Schema | Cố định, khai báo trước | Linh hoạt, động | Không có schema (value là blob) |
| Ngôn ngữ truy vấn | SQL, hỗ trợ `JOIN` mạnh | Query API riêng (theo field, không join tốt) | Chỉ `GET`/`SET` theo key (một số hỗ trợ thêm) |
| Quan hệ dữ liệu | Chuẩn hoá (normalize), join nhiều bảng | Denormalize, nhúng dữ liệu liên quan vào 1 document | Không có khái niệm quan hệ |
| ACID / Transaction | Đầy đủ, đa bảng | Chủ yếu ở cấp document, multi-doc transaction giới hạn | Rất hạn chế (thường chỉ atomic ở 1 key) |
| Consistency mặc định | Strong consistency | Thường strong ở 1 node, eventual khi phân tán | Thường eventual khi phân tán (trừ khi cấu hình khác) |
| Khả năng mở rộng | Chủ yếu dọc, ngang khó | Ngang, dễ shard hơn | Ngang, dễ nhất trong 3 loại |
| Hiệu năng đọc/ghi đơn giản | Tốt, nhưng có overhead do ACID/join | Tốt | Cực nhanh (đặc biệt in-memory) |
| Độ phức tạp truy vấn hỗ trợ | Cao (join, aggregate, subquery) | Trung bình (filter, index theo field) | Rất thấp (chỉ theo key) |
| Ví dụ sản phẩm | PostgreSQL, MySQL, Oracle, SQL Server | MongoDB, Couchbase, Firestore | Redis, DynamoDB, Memcached, etcd |
| Use case điển hình | Giao dịch tài chính, ERP, hệ thống cần báo cáo phức tạp | Catalog sản phẩm, CMS, profile người dùng | Cache, session, counter, feature flag |

## 3. Khung quyết định — chọn loại nào khi nào

```
Dữ liệu có cần transaction đa bảng, ACID tuyệt đối
(vd: chuyển tiền, đặt hàng trừ tồn kho + tạo hoá đơn)?
│
├── CÓ → RDBMS (hoặc NewSQL nếu cần scale ngang mà vẫn giữ ACID)
│
└── KHÔNG
    │
    ├── Dữ liệu có cấu trúc thay đổi linh hoạt, lồng nhau,
    │   không cần join phức tạp, cần scale ngang dễ?
    │   → Document Database
    │
    └── Chỉ cần tra cứu cực nhanh theo 1 key, dữ liệu tạm thời
        hoặc có thể tái tạo được, chấp nhận mất mát nếu crash?
        → Key-Value Store
```

Trong thực tế, hệ thống lớn **hiếm khi chỉ dùng 1 loại** — xem mục 5 (Polyglot Persistence).

## 4. Case study thực tế

### 4.1 Ngành ngân hàng — giao dịch tài chính

**Đặc điểm nghiệp vụ**: 1 giao dịch chuyển khoản phải trừ tiền tài khoản A **và** cộng tiền tài khoản B **cùng lúc** — không được phép có trạng thái chỉ trừ mà chưa cộng (mất tiền), hoặc chỉ cộng mà chưa trừ (tạo tiền từ hư không). Đây là ví dụ kinh điển của **ACID transaction bắt buộc**, cộng thêm yêu cầu audit trail đầy đủ (mọi thay đổi phải truy vết được) và tuân thủ quy định tài chính (Basel, PCI-DSS...).

**Vì sao gần như luôn là RDBMS**:
- Transaction đa bảng (bảng tài khoản, bảng giao dịch, bảng số dư, bảng đối chiếu) cần chạy atomic — đúng thế mạnh cốt lõi của RDBMS.
- Dữ liệu có quan hệ chặt chẽ (khách hàng — tài khoản — giao dịch — sản phẩm vay/tiết kiệm) cần `JOIN` để đối chiếu, báo cáo.
- Cơ quan quản lý (ngân hàng nhà nước, SWIFT...) yêu cầu tính nhất quán và khả năng audit rất cao — RDBMS với hàng chục năm phát triển cho enterprise là lựa chọn ít rủi ro nhất.

**Ví dụ thực tế (đã công bố công khai)**:
- **Capital One** (Mỹ) — công khai chuyển toàn bộ hạ tầng lên AWS (đóng cửa toàn bộ data center riêng năm 2020), core banking chạy trên **Amazon Aurora** (tương thích PostgreSQL/MySQL, vẫn là RDBMS quan hệ, chỉ khác là managed cloud) cho các hệ thống giao dịch, kết hợp DynamoDB/Cassandra cho các service phụ trợ (không phải giao dịch lõi). *(Nguồn: AWS re:Invent talks, Capital One Tech blog)*
- **DBS Bank** (Singapore) — công khai chia sẻ hành trình chuyển đổi số, core banking transaction vẫn dựa trên RDBMS quan hệ (kết hợp mainframe truyền thống cho phần lõi), trong khi các service số hoá (app, API) dùng thêm PostgreSQL/Cassandra cho phần không phải giao dịch lõi. *(Nguồn: DBS Tech blog, hội nghị)*

**Về các ngân hàng Việt Nam** (Vietcombank, Techcombank, BIDV, VPBank...): các ngân hàng **không công bố công khai** chi tiết database đang dùng cho hệ thống core banking (lý do bảo mật/an ninh hệ thống tài chính). Tuy nhiên theo **thông lệ ngành phổ biến toàn cầu**: phần lớn ngân hàng (kể cả tại Việt Nam) triển khai core banking trên các phần mềm thương mại như **Temenos T24**, **Oracle FLEXCUBE**, hoặc **Silverlake SIBS** — và cả 3 sản phẩm này đều được thiết kế để chạy trên **Oracle Database** (một số hỗ trợ thêm DB2). Đây là lý do Oracle DB chiếm thị phần áp đảo trong core banking toàn cầu suốt nhiều thập kỷ — không phải vì "Oracle tốt nhất" tuyệt đối, mà vì hệ sinh thái core banking vendor được xây dựng và kiểm chứng (certified) trên nền tảng đó, và ngành ngân hàng cực kỳ thận trọng khi thay đổi hạ tầng lõi.

Ở lớp ứng dụng xung quanh core banking (mobile app, internet banking, API gateway), các ngân hàng hiện đại thường bổ sung thêm Redis (cache session/OTP), đôi khi MongoDB (lưu log, dữ liệu phi cấu trúc) — nhưng **phần giao dịch tài chính lõi (ghi Nợ/Có) hầu như luôn nằm trên RDBMS**.

### 4.2 Thương mại điện tử — Amazon, Shopee, Lazada

**Đặc điểm nghiệp vụ e-commerce rất đa dạng**, khác nhau theo từng phần hệ thống:
- Đặt hàng, thanh toán, trừ tồn kho → cần ACID (giống ngân hàng, tránh bán 1 sản phẩm cho 2 người khi chỉ còn 1 tồn kho).
- Catalog sản phẩm → mỗi ngành hàng có thuộc tính khác nhau (áo có size/màu, điện thoại có RAM/dung lượng) → schema linh hoạt phù hợp Document DB hơn.
- Giỏ hàng, session, cache trang sản phẩm, đếm lượt xem → cần tốc độ cực nhanh → Key-Value.

Chính vì vậy, **e-commerce quy mô lớn luôn là polyglot persistence** (dùng nhiều loại DB cùng lúc), không có "1 database duy nhất".

**Amazon** *(đã công bố công khai, độ tin cậy cao)*:
- Amazon.com bản thân **là nơi khai sinh ra DynamoDB**: năm 2004, hệ thống giỏ hàng của Amazon chạy trên Oracle bị quá tải/outage trong mùa mua sắm cao điểm. Đội ngũ Amazon viết whitepaper "Dynamo" (2007), đặt nền móng cho key-value store phân tán, sau này thương mại hoá thành dịch vụ **DynamoDB** (ra mắt 2012).
- Tại **AWS re:Invent 2019**, Amazon công bố chính thức đã hoàn tất di dời **75 petabyte dữ liệu** từ Oracle sang các database của AWS cho hệ thống nội bộ, bao gồm: **DynamoDB** (key-value, cho các service cần tốc độ/scale cực lớn như giỏ hàng, session), **Amazon Aurora** (RDBMS tương thích MySQL/PostgreSQL, cho các service vẫn cần quan hệ + transaction), **Redshift** (data warehouse cho phân tích), **ElastiCache/Redis** (cache).
- Kết luận: Amazon dùng **cả RDBMS lẫn Key-Value**, chia theo đúng nhu cầu từng service — đây là ví dụ polyglot persistence điển hình nhất trong ngành, được chính Amazon công khai chia sẻ như một case study chuyển đổi.

**Shopee** *(theo các bài blog kỹ thuật công khai từ đội ngũ kỹ sư Shopee — không phải công bố kiến trúc đầy đủ chính thức)*:
- Theo Shopee Engineering blog: hệ thống order/giao dịch lõi dùng **MySQL** được sharding mạnh (chia theo user_id/shop_id) để đáp ứng lượng traffic cực lớn dịp sale (9.9, 11.11, 12.12).
- **Redis** dùng cho cache, rate limiting, và các tính năng cần độ trễ thấp (hiển thị số lượng flash sale còn lại...).
- **Elasticsearch** cho tìm kiếm sản phẩm.
- Các hệ thống big data/phân tích dùng thêm Hadoop/HBase/các data warehouse nội bộ.

**Lazada** *(suy luận theo thông lệ, độ tin cậy thấp hơn — Lazada ít công bố chi tiết kỹ thuật hơn Shopee/Amazon)*:
- Lazada thuộc sở hữu phần lớn/toàn bộ bởi **Alibaba Group** từ 2016. Alibaba nổi tiếng với việc tự phát triển **OceanBase** (distributed RDBMS, xây dựng để thay thế Oracle, chịu tải khổng lồ trong sự kiện Double 11) và **Tair** (key-value store nội bộ, tương tự Redis).
- Lazada được biết là đã dần chuyển hạ tầng sang **Alibaba Cloud**, nên nhiều khả năng tận dụng chung hệ sinh thái database của Alibaba (OceanBase/PolarDB cho phần giao dịch, Tair/Redis cho cache) — nhưng đây là **suy luận hợp lý dựa trên quan hệ công ty mẹ**, không phải xác nhận chính thức từ Lazada cho từng hệ thống cụ thể.

## 5. Bài học: Polyglot Persistence

Điểm chung của mọi case study ở trên: **không có hệ thống lớn nào chỉ dùng 1 loại database**. Cách tiếp cận thực tế là chọn đúng loại DB cho đúng bài toán trong cùng 1 hệ thống:

| Thành phần hệ thống | Loại DB phù hợp | Lý do |
|---|---|---|
| Đặt hàng, thanh toán, trừ kho | RDBMS (hoặc NewSQL) | Cần ACID, tránh oversell/mất tiền |
| Catalog sản phẩm (thuộc tính đa dạng theo ngành hàng) | Document | Schema linh hoạt, không cần join |
| Giỏ hàng, session, cache trang sản phẩm | Key-Value (Redis) | Tốc độ, TTL tự nhiên, chấp nhận mất được |
| Tìm kiếm sản phẩm | Search engine (Elasticsearch) | Full-text search, filter phức tạp |
| Phân tích, báo cáo kinh doanh | Data warehouse (Redshift, BigQuery) | Aggregate khối lượng lớn, không cần real-time tuyệt đối |

## 6. Tóm tắt

- **RDBMS**: chọn khi cần ACID tuyệt đối và quan hệ dữ liệu phức tạp — không thể thay thế cho hệ thống tài chính lõi.
- **Document**: chọn khi dữ liệu có cấu trúc thay đổi linh hoạt, không cần join nặng — phù hợp catalog, CMS, profile.
- **Key-Value**: chọn khi cần tốc độ tối đa cho dữ liệu đơn giản, chấp nhận đánh đổi khả năng truy vấn — phù hợp cache, session, counter (xem thêm [../redis](../redis/README.md) cho các use case cụ thể).
- Hệ thống thực tế ở quy mô lớn (ngân hàng, e-commerce) luôn kết hợp nhiều loại — chọn đúng công cụ cho đúng việc quan trọng hơn tìm "database tốt nhất".
