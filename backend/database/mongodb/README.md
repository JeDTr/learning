# MongoDB — Use Cases & Thiết kế Schema

MongoDB (Document DB) phù hợp khi cấu trúc dữ liệu **thay đổi linh hoạt**, không cần `JOIN` nặng, và ứng dụng ưu tiên **tốc độ đọc** hơn là chuẩn hoá tuyệt đối. Khác biệt lớn nhất so với RDBMS không phải là cú pháp, mà là **tư duy thiết kế**: RDBMS thiết kế theo cấu trúc dữ liệu (chuẩn hoá trước, tối ưu sau), còn MongoDB thiết kế theo **access pattern** — hỏi "ứng dụng sẽ đọc/ghi dữ liệu này như thế nào" trước khi vẽ schema. Xem [../comparisons](../comparisons/README.md) để biết khi nào nên chọn Document DB thay vì RDBMS.

## 1. Nguyên tắc cốt lõi: Embed hay Reference?

Đây là quyết định thiết kế quan trọng nhất trong MongoDB — tương đương việc chuẩn hoá bảng trong RDBMS, nhưng đi theo hướng ngược lại.

| Tiêu chí | **Embed** (nhúng vào 1 document) | **Reference** (tách collection, lưu `_id` tham chiếu) |
|---|---|---|
| Quan hệ | "Contains" — dữ liệu con luôn đi cùng dữ liệu cha khi đọc | "References" — dữ liệu con có thể đứng độc lập, được nhiều nơi trỏ tới |
| Tần suất đọc chung | Đọc cha luôn cần đọc con ngay | Không phải lúc nào đọc cha cũng cần đọc con |
| Số lượng phần tử | Có giới hạn, tăng chậm (vài chục đến vài trăm) | Không giới hạn hoặc tăng nhanh, không kiểm soát được |
| Cần update độc lập | Không — sửa con sẽ sửa qua document cha | Có — nhiều nơi cùng tham chiếu 1 bản ghi, sửa 1 chỗ áp dụng mọi nơi |
| Giới hạn kỹ thuật | Document tối đa **16MB**, mảng quá lớn làm chậm mọi thao tác đọc/ghi document đó | Cần thêm 1 query (hoặc `$lookup`) để lấy dữ liệu liên quan |
| Ví dụ | Địa chỉ giao hàng trong đơn hàng, thuộc tính sản phẩm | Comment của 1 bài viết có hàng nghìn user, sản phẩm trong nhiều đơn hàng |

**Quy tắc kinh nghiệm**: bắt đầu bằng embed (tận dụng thế mạnh document), chỉ tách ra reference khi mảng **không có giới hạn tự nhiên** hoặc dữ liệu con cần được truy vấn/sửa độc lập.

## 2. Các mẫu thiết kế (schema design patterns) phổ biến

| Pattern | Vấn đề giải quyết | Ý tưởng |
|---|---|---|
| **Embedding** | Dữ liệu luôn đọc cùng nhau, số lượng giới hạn | Nhúng thẳng vào document cha |
| **Referencing** | Dữ liệu dùng chung, số lượng không giới hạn | Tách collection riêng, lưu `_id` tham chiếu |
| **Subset** | Mảng con lớn nhưng chỉ cần hiển thị 1 phần khi đọc document cha (vd: 10 review mới nhất) | Nhúng **1 phần** (subset) + tham chiếu sang collection đầy đủ |
| **Bucket** | Dữ liệu time-series/log sinh ra liên tục (mỗi giây/phút 1 bản ghi) — 1 document/bản ghi làm index phình to | Gom nhiều bản ghi cùng khoảng thời gian vào **1 document "bucket"** |
| **Outlier** | Đa số document nhỏ (embed được), nhưng thiểu số "lệch chuẩn" (celebrity account, viral post) vượt giới hạn 16MB | Embed bình thường cho đa số; đánh dấu `has_extras` và lưu phần dư sang document/collection phụ cho thiểu số |
| **Extended Reference** | Reference chuẩn nhưng phải query thêm để lấy vài field hay dùng (vd: tên + avatar user trong mỗi post) | Nhúng **sẵn vài field hay đọc** cùng với `_id` tham chiếu — đánh đổi 1 chút denormalize lấy tốc độ đọc |
| **Attribute** | Thuộc tính khác nhau theo từng loại bản ghi (áo có size/màu, điện thoại có RAM), khó index hết từng field | Gom các thuộc tính biến đổi vào 1 mảng `{key, value}`, đánh 1 index duy nhất trên mảng đó |
| **Polymorphic** | Nhiều loại document khác nhau nhưng cùng nghiệp vụ (vd: nhiều loại thông báo) nằm chung 1 collection | Thêm field `type` để phân biệt, mỗi loại có field riêng ngoài các field chung |

## 3. [use-cases/](use-cases/) — Các bài toán thực tế

Mỗi bài toán mô tả vấn đề nghiệp vụ, document schema, quyết định embed/reference, index cần thiết, và các pitfall thường gặp.

1. [Catalog sản phẩm E-commerce](use-cases/01-ecommerce-catalog/README.md) — Attribute pattern, Subset pattern cho review
2. [Blog/CMS — bài viết và comment](use-cases/02-blog-cms/README.md) — ngưỡng embed vs reference cho dữ liệu lồng nhau, so sánh với recursive CTE ở RDBMS
3. [Mạng xã hội — follow/feed](use-cases/03-social-feed/README.md) — Outlier pattern (celebrity account), Extended Reference pattern
4. [IoT/Analytics — dữ liệu cảm biến theo thời gian](use-cases/04-iot-timeseries/README.md) — Bucket pattern, MongoDB Time Series Collection

## 4. Tổng kết — chọn pattern nào khi nào

```
Dữ liệu con có bị chặn trên (bounded) về số lượng không?
│
├── CÓ, số lượng nhỏ và luôn đọc cùng cha
│   → Embedding thuần
│
├── CÓ nhưng thỉnh thoảng có outlier vượt giới hạn (celebrity, viral)
│   → Embedding + Outlier pattern
│
└── KHÔNG, tăng không giới hạn theo thời gian/hoạt động
    │
    ├── Chỉ cần hiển thị 1 phần nhỏ khi đọc document cha (vd: review mới nhất)
    │   → Subset pattern
    │
    ├── Sinh liên tục theo thời gian, ghi nhiều, query theo khoảng thời gian
    │   → Bucket pattern (hoặc Time Series Collection có sẵn từ MongoDB 5.0)
    │
    └── Cần truy vấn/sửa độc lập, được nhiều nơi tham chiếu
        → Referencing thuần (kèm Extended Reference nếu cần vài field hay đọc)
```

## 5. Lưu ý khi thiết kế MongoDB (khác biệt so với thói quen RDBMS)

- **Không có `JOIN` mạnh** — `$lookup` trong aggregation pipeline tồn tại nhưng chậm hơn nhiều so với `JOIN` có index tốt của RDBMS. Thiết kế nên tránh phải `$lookup` trên đường query nóng (hot path).
- **Transaction đa document tồn tại** (từ 4.0, đầy đủ hơn từ 4.2 với sharded cluster) nhưng **tốn hiệu năng đáng kể** hơn transaction 1 document — chỉ dùng khi thực sự cần (vd: chuyển điểm thưởng giữa 2 user), không dùng làm thói quen mặc định như RDBMS.
- **Giới hạn 16MB/document** và **mảng không giới hạn là anti-pattern kinh điển** (`Massive Arrays Antipattern`) — mảng tăng vô hạn (comment, log, notification) không bao giờ nên nhúng thẳng, phải dùng Subset/Bucket/Referencing.
- **Denormalize có chủ đích là bình thường**, không phải "thiết kế tồi" như trong RDBMS — miễn là hiểu rõ đánh đổi: dữ liệu trùng lặp phải đồng bộ khi bản gốc đổi (chấp nhận eventual, hoặc cập nhật qua background job/change stream).
- **Index vẫn quan trọng như RDBMS** — thiếu index trên field dùng để filter/sort sẽ collection scan toàn bộ document, kể cả khi schema "linh hoạt".

## 6. Khi nào KHÔNG nên chỉ dùng MongoDB

- Cần transaction đa bản ghi phức tạp, tần suất cao, tuyệt đối không sai (vd: sổ cái ngân hàng double-entry) → RDBMS phù hợp hơn, xem [Sổ cái ngân hàng](../rdbms/use-cases/05-bank-ledger/README.md).
- Dữ liệu quan hệ nhiều tầng cần `JOIN` phức tạp thường xuyên trên tập dữ liệu lớn (báo cáo tài chính đa bảng) → RDBMS hoặc data warehouse.
- Hệ thống lớn trong thực tế hầu như luôn là **polyglot persistence** — MongoDB cho phần dữ liệu linh hoạt, kết hợp RDBMS cho phần cần ACID chặt và Redis cho cache/session (xem case study Amazon/Shopee ở [../comparisons](../comparisons/README.md#4-case-study-thực-tế)).
