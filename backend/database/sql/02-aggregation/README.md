# Aggregation nâng cao — GROUP BY, HAVING, GROUPING SETS, FILTER

Dùng schema chung ở [../schema/seed.sql](../schema/seed.sql).

## 1. GROUP BY nhiều cột + JOIN

**Bài toán**: tính doanh thu (chỉ tính đơn `completed`) theo từng khách hàng.

```sql
SELECT c.name AS customer,
       SUM(oi.quantity * oi.unit_price) AS revenue
FROM customers c
JOIN orders o      ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'completed'
GROUP BY c.id, c.name
ORDER BY revenue DESC;
```

Lưu ý: `GROUP BY c.id, c.name` chứ không chỉ `c.name` — nếu 2 khách hàng trùng tên, gộp theo tên sẽ sai. PostgreSQL/MySQL cho phép `GROUP BY` theo cột không phải khoá miễn là **functionally dependent** vào PK đã có trong `GROUP BY` (ở đây `c.id` là PK nên `c.name` hợp lệ), nhưng thói quen đúng là luôn group theo khoá.

## 2. HAVING — lọc sau khi gộp nhóm

**Bài toán**: tìm khách hàng có tổng doanh thu > 1000.

```sql
SELECT c.name AS customer,
       SUM(oi.quantity * oi.unit_price) AS revenue
FROM customers c
JOIN orders o ON o.customer_id = c.id AND o.status = 'completed'
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id, c.name
HAVING SUM(oi.quantity * oi.unit_price) > 1000;
```

Phân biệt `WHERE` vs `HAVING`: `WHERE` lọc **từng dòng trước khi gộp nhóm** (không được dùng hàm aggregate như `SUM`), `HAVING` lọc **sau khi đã gộp nhóm** (bắt buộc khi điều kiện dựa trên kết quả aggregate). Đặt điều kiện `o.status = 'completed'` ở `WHERE`/`JOIN ON` thay vì `HAVING` để DB lọc sớm, tránh gộp nhóm dữ liệu thừa rồi mới bỏ.

## 3. FILTER — aggregate có điều kiện, thay cho CASE WHEN lồng trong SUM

**Bài toán**: trong 1 dòng kết quả, vừa đếm tổng số đơn, vừa đếm số đơn completed, vừa đếm số đơn cancelled cho mỗi khách hàng.

```sql
SELECT c.name AS customer,
       COUNT(*) AS total_orders,
       COUNT(*) FILTER (WHERE o.status = 'completed') AS completed_orders,
       COUNT(*) FILTER (WHERE o.status = 'cancelled') AS cancelled_orders
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY c.id;
```

`FILTER (WHERE ...)` (PostgreSQL) rõ ràng hơn cách viết cũ `SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`. **MySQL không có `FILTER`** — phải dùng `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` hoặc `COUNT(CASE WHEN ... THEN 1 END)` (không có `ELSE` → NULL bị `COUNT` bỏ qua).

## 4. GROUPING SETS / ROLLUP — nhiều mức tổng hợp trong 1 query

**Bài toán**: báo cáo doanh thu theo `category`, cộng thêm 1 dòng tổng cộng toàn bộ (subtotal + grand total) — thường cần cho báo cáo dạng bảng Excel.

```sql
SELECT p.category,
       SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN orders o   ON o.id = oi.order_id AND o.status = 'completed'
GROUP BY ROLLUP (p.category)
ORDER BY p.category NULLS LAST;
```

`ROLLUP (p.category)` sinh ra các dòng gộp theo từng `category`, **cộng thêm 1 dòng `category = NULL`** là tổng toàn bộ. Nếu không dùng `ROLLUP`, phải viết `UNION ALL` giữa query gộp theo category và query `SUM` không `GROUP BY` — `ROLLUP`/`GROUPING SETS` gộp cả 2 vào 1 lần quét dữ liệu, hiệu quả hơn.

Muốn phân biệt dòng "tổng cộng" (`category = NULL` do ROLLUP) với dòng thật sự có category NULL trong dữ liệu, dùng hàm `GROUPING()`:

```sql
SELECT
    CASE WHEN GROUPING(p.category) = 1 THEN 'TOTAL' ELSE p.category END AS category,
    SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN products p ON p.id = oi.product_id
GROUP BY ROLLUP (p.category);
```

## 5. Đếm phân biệt (DISTINCT) trong aggregate

**Bài toán**: mỗi tháng có bao nhiêu khách hàng **khác nhau** đã đặt đơn (không đếm trùng khách đặt nhiều đơn trong tháng).

```sql
SELECT DATE_TRUNC('month', order_date) AS month,
       COUNT(DISTINCT customer_id) AS distinct_customers,
       COUNT(*) AS total_orders
FROM orders
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month;
```

`COUNT(DISTINCT ...)` tốn chi phí hơn `COUNT(*)` (DB phải khử trùng lặp trước khi đếm) — với bảng lớn, cân nhắc dùng `APPROX_COUNT_DISTINCT`/`HyperLogLog` (nếu DB hỗ trợ) khi chỉ cần số gần đúng.
