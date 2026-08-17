# Subquery & CTE nâng cao — correlated subquery, EXISTS, Recursive CTE

Dùng schema chung ở [../schema/seed.sql](../schema/seed.sql).

## 1. Correlated subquery — subquery phụ thuộc vào từng dòng ngoài

**Bài toán**: tìm nhân viên có lương **cao hơn lương trung bình của phòng ban mình**.

```sql
SELECT e.name, e.salary, e.department_id
FROM employees e
WHERE e.salary > (
    SELECT AVG(e2.salary)
    FROM employees e2
    WHERE e2.department_id = e.department_id   -- tham chiếu ra ngoài -> "correlated"
)
ORDER BY e.department_id;
```

Khác với subquery độc lập (chạy 1 lần), subquery correlated **chạy lại cho mỗi dòng** của bảng ngoài vì điều kiện `e2.department_id = e.department_id` phụ thuộc vào dòng đang xét. Với bảng lớn nên kiểm tra kế hoạch thực thi (`EXPLAIN ANALYZE`) — nhiều DB tối ưu được thành join, nhưng không phải lúc nào cũng vậy; cách viết bằng window function thường nhanh và rõ hơn:

```sql
SELECT name, salary, department_id
FROM (
    SELECT name, salary, department_id,
           AVG(salary) OVER (PARTITION BY department_id) AS dept_avg
    FROM employees
) t
WHERE salary > dept_avg;
```

## 2. EXISTS vs IN vs JOIN — khi nào dùng cái nào

**Bài toán**: tìm khách hàng đã từng mua ít nhất 1 sản phẩm thuộc category `Electronics`.

```sql
-- Cách 1: EXISTS — dừng ngay khi tìm thấy 1 kết quả khớp, không quan tâm số lượng
SELECT c.name
FROM customers c
WHERE EXISTS (
    SELECT 1
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE o.customer_id = c.id AND p.category = 'Electronics'
);

-- Cách 2: JOIN + DISTINCT — cần DISTINCT vì 1 khách có thể khớp nhiều dòng order_items
SELECT DISTINCT c.name
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE p.category = 'Electronics';
```

- `EXISTS`: tối ưu nhất khi chỉ cần biết "có/không", vì DB có thể dừng ngay khi tìm thấy 1 bản ghi khớp (short-circuit), không cần đếm/join hết toàn bộ.
- `IN (subquery)`: dễ đọc nhưng **nguy hiểm với NULL** (xem mục anti-join ở [../01-joins](../01-joins/README.md#2-tìm-bản-ghi-mồ-côi-bằng-left-join--is-null-anti-join)) và một số DB cũ tối ưu kém hơn `EXISTS`.
- `JOIN`: cần khi muốn lấy thêm cột từ bảng bên phải, nhưng phải nhớ `DISTINCT` nếu quan hệ 1-nhiều để tránh nhân bản dòng.

## 3. CTE (`WITH`) — đặt tên cho subquery để dễ đọc và tái sử dụng

**Bài toán**: tính % doanh thu mỗi khách hàng đóng góp trên tổng doanh thu toàn hệ thống.

```sql
WITH customer_revenue AS (
    SELECT c.id, c.name,
           SUM(oi.quantity * oi.unit_price) AS revenue
    FROM customers c
    JOIN orders o ON o.customer_id = c.id AND o.status = 'completed'
    JOIN order_items oi ON oi.order_id = o.id
    GROUP BY c.id, c.name
),
total_revenue AS (
    SELECT SUM(revenue) AS total FROM customer_revenue
)
SELECT cr.name, cr.revenue,
       ROUND(100.0 * cr.revenue / tr.total, 1) AS pct_of_total
FROM customer_revenue cr, total_revenue tr
ORDER BY cr.revenue DESC;
```

`WITH` không tối ưu hiệu năng tự thân (PostgreSQL >= 12 có thể inline CTE giống subquery thường) — giá trị chính là **chia nhỏ query phức tạp thành các bước có tên rõ ràng**, dễ test từng phần (chạy riêng `SELECT * FROM customer_revenue` để debug) và dễ review hơn 1 subquery lồng nhiều tầng.

## 4. Recursive CTE — duyệt cấu trúc cây/đồ thị

**Bài toán A**: liệt kê toàn bộ nhân viên **cấp dưới** (trực tiếp và gián tiếp) của "Binh (CTO)", kèm cấp bậc (level) trong cây tổ chức.

```sql
WITH RECURSIVE subordinates AS (
    -- anchor: điểm bắt đầu đệ quy
    SELECT id, name, manager_id, 0 AS level
    FROM employees
    WHERE name = 'Binh (CTO)'

    UNION ALL

    -- recursive: nối thêm từng cấp con, dừng khi không còn dòng khớp
    SELECT e.id, e.name, e.manager_id, s.level + 1
    FROM employees e
    JOIN subordinates s ON e.manager_id = s.id
)
SELECT id, name, level
FROM subordinates
WHERE level > 0   -- bỏ chính "Binh" ra khỏi kết quả
ORDER BY level, name;
```

**Bài toán B** (chiều ngược lại): từ 1 nhân viên bất kỳ, truy ngược lên toàn bộ chuỗi quản lý đến CEO.

```sql
WITH RECURSIVE reporting_chain AS (
    SELECT id, name, manager_id, 0 AS level
    FROM employees
    WHERE name = 'Phong'

    UNION ALL

    SELECT e.id, e.name, e.manager_id, rc.level + 1
    FROM employees e
    JOIN reporting_chain rc ON e.id = rc.manager_id
)
SELECT id, name, level FROM reporting_chain ORDER BY level;
```

Cấu trúc `WITH RECURSIVE` luôn gồm 2 phần nối bằng `UNION ALL`: **anchor member** (điều kiện khởi đầu, chạy 1 lần) và **recursive member** (tự tham chiếu tên CTE, chạy lặp lại cho đến khi không sinh thêm dòng nào). Dùng `UNION ALL` chứ không phải `UNION` vì không cần khử trùng lặp và tránh chi phí sort không cần thiết. Nếu dữ liệu có chu trình (A quản lý B, B quản lý A — lỗi dữ liệu), đệ quy sẽ chạy vô hạn; production code nên thêm giới hạn độ sâu hoặc mảng chống lặp (`path @> ARRAY[e.id]`).
