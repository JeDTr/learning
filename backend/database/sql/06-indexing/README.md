# Composite Index — leftmost-prefix rule, chứng minh bằng EXPLAIN ANALYZE

Dùng dữ liệu riêng ở [index_demo.sql](index_demo.sql) — bảng `orders_bulk` với **300.000 dòng ngẫu nhiên**. Các bảng ở [../schema/seed.sql](../schema/seed.sql) chỉ có vài chục dòng nên PostgreSQL luôn chọn `Seq Scan` (quét tuần tự cả bảng nhỏ vẫn nhanh hơn mở index) — không đủ dữ liệu để thấy index tạo khác biệt thật. Toàn bộ kết quả `EXPLAIN ANALYZE` dưới đây là **chạy thật** trên PostgreSQL 17 local, không phải số liệu giả định.

## 1. Composite index là gì

Composite index (multi-column index) là 1 index được xây trên **nhiều cột cùng lúc**, dữ liệu trong index được sắp xếp theo cột đầu trước, cột sau chỉ có tác dụng sắp xếp phụ trong phạm vi cùng giá trị cột đầu — giống cách sắp xếp danh bạ theo `(Họ, Tên)`: tra theo Họ rất nhanh, nhưng tra theo Tên một mình thì vô dụng vì Tên không được sắp xếp liên tục trong toàn bộ danh bạ.

```sql
CREATE INDEX idx_orders_bulk_customer_date ON orders_bulk(customer_id, order_date);
```

## 2. Trước khi có index — baseline

```sql
EXPLAIN ANALYZE SELECT * FROM orders_bulk WHERE customer_id = 42;
```

```
Gather  (cost=1000.00..5325.88 rows=60 width=25) (actual time=1.157..25.975 rows=60 loops=1)
  ->  Parallel Seq Scan on orders_bulk (actual time=0.523..19.962 rows=30 loops=2)
        Filter: (customer_id = 42)
        Rows Removed by Filter: 149970
Execution Time: 26.031 ms
```

Không có index nào phù hợp → PostgreSQL phải quét toàn bộ 300k dòng, loại bỏ ~149.970 dòng không khớp, tốn **~26ms**.

## 3. Sau khi tạo composite index — leftmost-prefix rule

Sau `CREATE INDEX idx_orders_bulk_customer_date ON orders_bulk(customer_id, order_date)` (+ `ANALYZE`):

**3a. Lọc theo `customer_id` (đúng cột đầu tiên) → dùng index**

```sql
EXPLAIN ANALYZE SELECT * FROM orders_bulk WHERE customer_id = 42;
```
```
Bitmap Heap Scan on orders_bulk (actual time=0.022..0.114 rows=60 loops=1)
  Recheck Cond: (customer_id = 42)
  ->  Bitmap Index Scan on idx_orders_bulk_customer_date (actual time=0.014..0.014 rows=60 loops=1)
        Index Cond: (customer_id = 42)
Execution Time: 0.150 ms
```

**26.031ms → 0.150ms**, nhanh hơn ~170 lần.

**3b. Lọc theo cả `customer_id` VÀ `order_date` → dùng index, nhanh hơn nữa**

```sql
EXPLAIN ANALYZE SELECT * FROM orders_bulk
WHERE customer_id = 42 AND order_date = DATE '2021-06-15';
```
```
Index Scan using idx_orders_bulk_customer_date on orders_bulk (actual time=0.006..0.006 rows=0 loops=1)
  Index Cond: ((customer_id = 42) AND (order_date = '2021-06-15'::date))
Execution Time: 0.026 ms
```

Cả 2 điều kiện đều nằm trong `Index Cond` — PostgreSQL dùng index để thu hẹp trực tiếp xuống đúng vị trí cần tìm, không cần "Recheck" lại ở bảng dữ liệu.

**3c. Lọc CHỈ theo `order_date` (cột thứ 2, KHÔNG phải cột đầu) → index vô dụng, quay lại Seq Scan**

```sql
EXPLAIN ANALYZE SELECT * FROM orders_bulk WHERE order_date = DATE '2021-06-15';
```
```
Gather  (cost=1000.00..5334.78 rows=149 width=25) (actual time=0.234..9.787 rows=135 loops=1)
  ->  Parallel Seq Scan on orders_bulk (actual time=0.151..7.212 rows=68 loops=2)
        Filter: (order_date = '2021-06-15'::date)
        Rows Removed by Filter: 149932
Execution Time: 9.818 ms
```

Đây chính là **leftmost-prefix rule**: composite index `(customer_id, order_date)` chỉ dùng được khi query có điều kiện `=` (hoặc range) trên **cột đầu tiên** (`customer_id`), dùng riêng một mình hoặc kèm thêm các cột sau nó theo đúng thứ tự. Bỏ qua cột đầu và lọc thẳng vào cột sau (`order_date`) khiến index không thể dùng được — giống việc không thể tra danh bạ theo Tên khi danh bạ chỉ sắp xếp theo `(Họ, Tên)`.

## 4. Cách khắc phục khi cần lọc theo cả 2 chiều

Nếu ứng dụng thực sự cần cả 2 kiểu truy vấn (theo `customer_id` một mình **và** theo `order_date` một mình), composite index không thay thế được — cần thêm 1 index đơn cột riêng cho `order_date`:

```sql
CREATE INDEX idx_orders_bulk_order_date ON orders_bulk(order_date);
```

```sql
EXPLAIN ANALYZE SELECT * FROM orders_bulk WHERE order_date = DATE '2021-06-15';
```
```
Bitmap Heap Scan on orders_bulk (actual time=0.032..0.261 rows=135 loops=1)
  ->  Bitmap Index Scan on idx_orders_bulk_order_date (actual time=0.020..0.020 rows=135 loops=1)
        Index Cond: (order_date = '2021-06-15'::date)
Execution Time: 0.293 ms
```

## 5. Thứ tự cột trong composite index quan trọng thế nào

Đổi thứ tự thành `(order_date, customer_id)` rồi thử lại đúng query lọc theo `customer_id` một mình ở mục 3a:

```sql
CREATE INDEX idx_wrong_order ON orders_bulk(order_date, customer_id);

EXPLAIN ANALYZE SELECT * FROM orders_bulk WHERE customer_id = 42;
```
```
Gather (cost=1000.00..5325.88 rows=60 width=25) (actual time=0.470..7.855 rows=60 loops=1)
  ->  Parallel Seq Scan on orders_bulk (actual time=0.194..5.703 rows=30 loops=2)
        Filter: (customer_id = 42)
Execution Time: 7.879 ms
```

Quay lại `Seq Scan` — index tồn tại nhưng **sai thứ tự cột** so với cách query lọc dữ liệu nên hoàn toàn không giúp được gì. Nguyên tắc chọn thứ tự cột:

1. **Cột dùng điều kiện `=` (equality) đặt trước cột dùng điều kiện range (`>`, `<`, `BETWEEN`)** — vì sau khi qua 1 điều kiện range, index không còn giữ được thứ tự sắp xếp có ích cho các cột tiếp theo.
2. Trong nhóm equality, cột nào **xuất hiện trong nhiều query nhất** (hoặc chọn lọc cao hơn — nhiều giá trị phân biệt hơn) thường nên đặt trước, để 1 index composite phục vụ được nhiều pattern query khác nhau nhờ leftmost-prefix (VD: index `(customer_id, order_date)` phục vụ được cả query chỉ lọc `customer_id` lẫn query lọc cả 2 cột, nhưng index `(order_date, customer_id)` thì không phục vụ được query chỉ lọc `customer_id`).

## 6. Composite UNIQUE index — vừa chống trùng vừa tăng tốc query

`UNIQUE` trên composite index áp ràng buộc duy nhất lên **tổ hợp** các cột, không phải từng cột riêng lẻ — đây chính là cơ chế đứng sau composite primary key ở use case [Mạng xã hội](../../rdbms/use-cases/04-social-network/README.md) (VD: `UNIQUE(follower_id, followee_id)` đảm bảo 1 người chỉ follow 1 người khác đúng 1 lần) và partial unique index ở [Thư viện](../../rdbms/use-cases/02-library-loan/README.md).

## Tóm tắt

| Query lọc theo | Index `(customer_id, order_date)` | Index `(order_date, customer_id)` |
|---|---|---|
| `customer_id` | ✅ dùng được | ❌ Seq Scan |
| `order_date` | ❌ Seq Scan | ✅ dùng được |
| `customer_id AND order_date` | ✅ dùng được, nhanh nhất | ✅ dùng được, nhanh nhất |

Composite index không phải "càng nhiều cột càng tốt" — nó chỉ tăng tốc đúng những query lọc theo **tiền tố từ trái sang** (leftmost prefix) của các cột đã khai báo. Trước khi thêm index, xác định rõ pattern query thực tế của ứng dụng (cột nào luôn xuất hiện trong `WHERE`, cột nào xuất hiện một mình) rồi mới chọn thứ tự cột — và luôn xác nhận lại bằng `EXPLAIN ANALYZE` trên dữ liệu đủ lớn thay vì đoán, vì trên bảng nhỏ Postgres gần như luôn chọn `Seq Scan` dù có index hay không.
