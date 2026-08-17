# Window Functions — ROW_NUMBER, RANK, LAG/LEAD, running total

Dùng schema chung ở [../schema/seed.sql](../schema/seed.sql). Window function khác `GROUP BY` ở chỗ **không làm gộp giảm số dòng** — mỗi dòng vẫn giữ nguyên, chỉ thêm cột tính toán "nhìn" sang các dòng khác trong cùng `PARTITION`.

## 1. RANK vs DENSE_RANK vs ROW_NUMBER

**Bài toán**: xếp hạng lương nhân viên trong từng phòng ban.

```sql
SELECT department_id, name, salary,
       ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS row_num,
       RANK()       OVER (PARTITION BY department_id ORDER BY salary DESC) AS rank,
       DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS dense_rank
FROM employees
WHERE department_id IS NOT NULL
ORDER BY department_id, salary DESC;
```

Khác biệt khi có **giá trị trùng nhau** (ví dụ 2 người cùng lương hạng nhì):
- `ROW_NUMBER()`: luôn tăng dần 1-2-3-4..., không bao giờ trùng số — dùng khi cần thứ tự tuyệt đối (VD: chọn đúng 1 dòng đại diện).
- `RANK()`: 2 người cùng hạng 2 thì người tiếp theo nhảy thẳng lên hạng 4 (bỏ hạng 3) — giống xếp hạng thể thao.
- `DENSE_RANK()`: 2 người cùng hạng 2, người tiếp theo là hạng 3 (không nhảy số) — dùng khi cần "top N mức lương" mà không quan tâm bao nhiêu người trong mỗi mức.

## 2. Top-N theo từng nhóm (pattern rất hay gặp)

**Bài toán**: tìm sản phẩm bán chạy nhất (theo doanh thu) trong mỗi category.

```sql
WITH revenue_by_product AS (
    SELECT p.category, p.name,
           SUM(oi.quantity * oi.unit_price) AS revenue,
           ROW_NUMBER() OVER (PARTITION BY p.category ORDER BY SUM(oi.quantity * oi.unit_price) DESC) AS rn
    FROM products p
    JOIN order_items oi ON oi.product_id = p.id
    JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
    GROUP BY p.category, p.name
)
SELECT category, name, revenue
FROM revenue_by_product
WHERE rn = 1;
```

Đây là lý do window function tồn tại: không thể lấy "top 1 mỗi nhóm" chỉ bằng `GROUP BY` + `MAX` vì `MAX(revenue)` không tự động kéo theo đúng `name` tương ứng. Cách cũ (trước khi có window function) phải tự join lại với subquery `MAX` — phức tạp và dễ sai khi có 2 sản phẩm cùng doanh thu cao nhất.

## 3. LAG / LEAD — so sánh với dòng trước/sau

**Bài toán**: tính tăng trưởng doanh thu tháng này so với tháng trước (Month-over-Month).

```sql
WITH monthly_revenue AS (
    SELECT DATE_TRUNC('month', o.order_date)::date AS month,
           SUM(oi.quantity * oi.unit_price) AS revenue
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status = 'completed'
    GROUP BY DATE_TRUNC('month', o.order_date)
)
SELECT month, revenue,
       LAG(revenue) OVER (ORDER BY month) AS prev_month_revenue,
       revenue - LAG(revenue) OVER (ORDER BY month) AS mom_change,
       ROUND(
           100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
           / NULLIF(LAG(revenue) OVER (ORDER BY month), 0), 1
       ) AS mom_growth_pct
FROM monthly_revenue
ORDER BY month;
```

`LAG(col, n, default)` lấy giá trị của dòng thứ `n` **phía trước** trong cùng partition (mặc định `n=1`); `LEAD` lấy dòng phía sau. Tháng đầu tiên không có tháng trước nên `prev_month_revenue = NULL` — dùng `NULLIF(..., 0)` để tránh chia cho 0/NULL gây lỗi.

## 4. Running total (tổng dồn)

**Bài toán**: với mỗi đơn hàng completed, hiển thị doanh thu luỹ kế tính đến thời điểm đó.

```sql
SELECT o.id AS order_id, o.order_date,
       SUM(oi.quantity * oi.unit_price) AS order_total,
       SUM(SUM(oi.quantity * oi.unit_price)) OVER (ORDER BY o.order_date, o.id) AS running_total
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'completed'
GROUP BY o.id, o.order_date
ORDER BY o.order_date, o.id;
```

Mặc định khi có `ORDER BY` trong `OVER(...)` mà không khai báo frame, PostgreSQL dùng frame ngầm định `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` — chính là công thức tổng dồn. Có thể viết tường minh hơn bằng `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` để tránh nhầm lẫn khi có giá trị `order_date` trùng nhau (`RANGE` gộp các dòng có cùng giá trị `ORDER BY` lại, `ROWS` thì không).

## 5. Moving average (trung bình trượt)

**Bài toán**: trung bình doanh thu của đơn hiện tại và 2 đơn liền trước (cửa sổ trượt 3 đơn).

```sql
SELECT o.id, o.order_date,
       SUM(oi.quantity * oi.unit_price) AS order_total,
       ROUND(AVG(SUM(oi.quantity * oi.unit_price))
             OVER (ORDER BY o.order_date, o.id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) AS moving_avg_3
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'completed'
GROUP BY o.id, o.order_date
ORDER BY o.order_date, o.id;
```

`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` = cửa sổ gồm dòng hiện tại + 2 dòng ngay trước nó, di chuyển theo từng dòng — đây chính là ý nghĩa "trượt" (moving).

## 6. NTILE — chia thành N nhóm đều nhau

**Bài toán**: chia nhân viên thành 4 nhóm (tứ phân vị) theo lương, phục vụ phân tích lương "bottom 25% / top 25%".

```sql
SELECT name, salary,
       NTILE(4) OVER (ORDER BY salary) AS salary_quartile
FROM employees
ORDER BY salary;
```

`NTILE(4)` chia số dòng thành 4 nhóm gần bằng nhau nhất có thể (nếu không chia hết, các nhóm đầu sẽ nhiều hơn 1 dòng). Nhóm 1 = lương thấp nhất, nhóm 4 = lương cao nhất.
