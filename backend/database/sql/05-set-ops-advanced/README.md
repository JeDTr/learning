# Set operations & bài toán tổng hợp — UNION/INTERSECT/EXCEPT, PIVOT, gaps & islands

Dùng schema chung ở [../schema/seed.sql](../schema/seed.sql). Phần này gom các kỹ thuật hay bị hỏi trong phỏng vấn vì phải kết hợp nhiều thứ ở 01-04.

## 1. UNION / UNION ALL — gộp kết quả 2 query có cùng số cột & kiểu dữ liệu

**Bài toán**: tạo 1 danh sách "liên hệ cần theo dõi" gồm cả khách hàng chưa từng mua hàng và nhân viên chưa được gán phòng ban.

```sql
SELECT 'customer_no_order' AS reason, c.name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)

UNION ALL

SELECT 'employee_no_department' AS reason, e.name
FROM employees e
WHERE e.department_id IS NULL;
```

`UNION` tự động loại bỏ dòng trùng lặp hoàn toàn (tốn thêm chi phí sort/hash để so sánh) — `UNION ALL` giữ nguyên tất cả, nhanh hơn. Chỉ dùng `UNION` (không `ALL`) khi thực sự cần khử trùng và chắc chắn 2 tập kết quả có thể trùng nhau.

## 2. INTERSECT / EXCEPT — giao và hiệu giữa 2 tập kết quả

**Bài toán**: tìm khách hàng đã mua **cả** `Electronics` **và** `Furniture` (giao 2 tập).

```sql
SELECT customer_id FROM (
    SELECT o.customer_id
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE p.category = 'Electronics'
) e

INTERSECT

SELECT customer_id FROM (
    SELECT o.customer_id
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE p.category = 'Furniture'
) f;
```

`EXCEPT` (MySQL 8.0.31+ mới có; trước đó phải mô phỏng bằng `LEFT JOIN ... WHERE right IS NULL` như ở [01-joins](../01-joins/README.md#2-tìm-bản-ghi-mồ-côi-bằng-left-join--is-null-anti-join)) trả về dòng có ở tập đầu nhưng **không có** ở tập sau — ví dụ khách mua `Electronics` nhưng chưa từng mua `Furniture` thì đổi `INTERSECT` thành `EXCEPT` ở trên.

## 3. PIVOT thủ công bằng CASE WHEN + aggregate

**Bài toán**: bảng doanh thu dạng ma trận — mỗi hàng là 1 khách hàng, mỗi cột là 1 category (Electronics / Furniture / Stationery).

```sql
SELECT c.name AS customer,
       SUM(CASE WHEN p.category = 'Electronics' THEN oi.quantity * oi.unit_price ELSE 0 END) AS electronics,
       SUM(CASE WHEN p.category = 'Furniture'   THEN oi.quantity * oi.unit_price ELSE 0 END) AS furniture,
       SUM(CASE WHEN p.category = 'Stationery'  THEN oi.quantity * oi.unit_price ELSE 0 END) AS stationery
FROM customers c
JOIN orders o ON o.customer_id = c.id AND o.status = 'completed'
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
GROUP BY c.id, c.name
ORDER BY c.name;
```

SQL chuẩn không có cú pháp `PIVOT` thống nhất (SQL Server có `PIVOT`, PostgreSQL cần extension `tablefunc`/`crosstab`) — cách `SUM(CASE WHEN ...)` này chạy được trên mọi DB và là kỹ thuật nên nhớ nằm lòng. Nhược điểm: phải biết trước danh sách cột (category) để viết cứng; nếu category động, xử lý pivot ở tầng ứng dụng sẽ linh hoạt hơn.

## 4. Gaps & Islands — tìm chuỗi ngày liên tiếp

**Bài toán**: khách hàng "Nguyen Van A" đặt 2 đơn liên tiếp (2026-01-05 và 2026-01-06). Tìm các **chuỗi ngày đặt hàng liên tiếp** (island) cho từng khách hàng — hữu ích để phát hiện hành vi bất thường hoặc tính streak.

```sql
WITH order_dates AS (
    SELECT DISTINCT customer_id, order_date
    FROM orders
    WHERE status = 'completed'
),
numbered AS (
    SELECT customer_id, order_date,
           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) AS rn
    FROM order_dates
),
grouped AS (
    SELECT customer_id, order_date,
           order_date - (rn * INTERVAL '1 day') AS island_key   -- ngày liên tiếp sẽ ra cùng 1 island_key
    FROM numbered
)
SELECT customer_id,
       MIN(order_date) AS streak_start,
       MAX(order_date) AS streak_end,
       COUNT(*) AS streak_length
FROM grouped
GROUP BY customer_id, island_key
HAVING COUNT(*) > 1     -- chỉ lấy chuỗi >= 2 ngày liên tiếp
ORDER BY customer_id, streak_start;
```

Ý tưởng cốt lõi: nếu lấy `order_date` trừ đi `ROW_NUMBER()` (đã sắp theo ngày) thì **các ngày liên tiếp nhau sẽ luôn cho ra cùng 1 giá trị hằng số** (`island_key`) — vì cả `order_date` và `rn` cùng tăng đều 1 đơn vị mỗi ngày. Đây là mẫu "gaps and islands" kinh điển, kết hợp window function (03) + CTE (04) + `GROUP BY/HAVING` (02).

## 5. Điền đủ khoảng ngày bị thiếu (dùng CROSS JOIN / generate_series)

**Bài toán**: báo cáo doanh thu theo ngày cho tháng 1/2026 — kể cả những ngày không phát sinh đơn hàng nào (hiển thị `0`, không được thiếu dòng).

```sql
SELECT d::date AS day,
       COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
FROM generate_series('2026-01-01'::date, '2026-01-31'::date, '1 day') AS d
LEFT JOIN orders o ON o.order_date = d AND o.status = 'completed'
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY d
ORDER BY d;
```

`generate_series` (PostgreSQL) sinh ra dãy ngày đầy đủ, đóng vai trò bảng "khung" bên trái để `LEFT JOIN` — pattern giống hệt `CROSS JOIN` ở [01-joins](../01-joins/README.md#6-cross-join--sinh-mọi-tổ-hợp-có-thể) nhưng dùng để lấp khoảng trống theo thời gian thay vì tổ hợp. MySQL không có `generate_series` sẵn — phải tạo bảng số/ngày phụ trợ (`recursive CTE` sinh dãy ngày, hoặc bảng `calendar` dựng sẵn) rồi làm tương tự.
