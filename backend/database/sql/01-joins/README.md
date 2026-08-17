# JOIN nâng cao — INNER, LEFT, RIGHT, FULL OUTER, SELF, CROSS

Dùng schema chung ở [../schema/seed.sql](../schema/seed.sql). Tất cả query chạy được trên PostgreSQL; phần khác biệt với MySQL ghi chú riêng.

## 1. LEFT JOIN — giữ tất cả bản ghi bên trái dù không khớp

**Bài toán**: liệt kê tất cả nhân viên kèm tên phòng ban, kể cả nhân viên chưa được gán phòng ban (`department_id IS NULL`).

```sql
SELECT e.name AS employee, d.name AS department
FROM employees e
LEFT JOIN departments d ON d.id = e.department_id
ORDER BY e.id;
```

`INNER JOIN` sẽ loại luôn "Lan" (chưa có phòng ban) khỏi kết quả — đây là lỗi phổ biến khi báo cáo cần đếm đủ 100% nhân viên. `LEFT JOIN` giữ lại dòng đó với `department = NULL`.

## 2. Tìm bản ghi "mồ côi" bằng LEFT JOIN + IS NULL (anti-join)

**Bài toán**: liệt kê khách hàng **chưa từng đặt đơn hàng nào**.

```sql
SELECT c.id, c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;
```

Mẫu `LEFT JOIN ... WHERE right.col IS NULL` là cách kinh điển để tìm "cái gì bên trái không có match bên phải". Tương đương và thường **nhanh hơn** trên tập dữ liệu lớn (planner dễ tối ưu hơn) là dùng `NOT EXISTS`:

```sql
SELECT c.id, c.name
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

Tránh dùng `NOT IN (SELECT customer_id FROM orders)` — nếu cột con chứa `NULL`, `NOT IN` trả về rỗng một cách âm thầm (do logic 3 trị `NULL`), rất dễ gây bug.

## 3. RIGHT JOIN — hiếm dùng, thường viết lại thành LEFT JOIN cho dễ đọc

**Bài toán**: liệt kê tất cả phòng ban kèm số nhân viên, kể cả phòng ban chưa có ai (`Marketing`).

```sql
-- Cách 1: RIGHT JOIN
SELECT d.name AS department, e.name AS employee
FROM employees e
RIGHT JOIN departments d ON d.id = e.department_id
ORDER BY d.name;

-- Cách 2: LEFT JOIN đảo thứ tự bảng — kết quả giống hệt, dễ đọc hơn
SELECT d.name AS department, e.name AS employee
FROM departments d
LEFT JOIN employees e ON e.department_id = d.id
ORDER BY d.name;
```

Quy ước thực tế: hầu như không ai dùng `RIGHT JOIN` trong code review — luôn đổi thứ tự bảng để dùng `LEFT JOIN`, vì đọc theo hướng "giữ tất cả bảng bên trái" nhất quán và dễ trace hơn.

## 4. FULL OUTER JOIN — giữ cả 2 bên dù có khớp hay không

**Bài toán**: đối chiếu toàn bộ nhân viên và phòng ban trong 1 kết quả duy nhất — thấy được cả nhân viên chưa gán phòng ban **và** phòng ban chưa có nhân viên.

```sql
SELECT e.name AS employee, d.name AS department
FROM employees e
FULL OUTER JOIN departments d ON d.id = e.department_id
ORDER BY d.name NULLS LAST, e.name;
```

Kết quả có 2 loại dòng "lệch": `employee = 'Lan', department = NULL` và `employee = NULL, department = 'Marketing'`.

**MySQL không hỗ trợ `FULL OUTER JOIN`** — phải mô phỏng bằng `UNION` của `LEFT JOIN` và `RIGHT JOIN`:

```sql
SELECT e.name AS employee, d.name AS department
FROM employees e LEFT JOIN departments d ON d.id = e.department_id
UNION
SELECT e.name AS employee, d.name AS department
FROM employees e RIGHT JOIN departments d ON d.id = e.department_id;
```

## 5. SELF JOIN — nối bảng với chính nó

**Bài toán**: liệt kê từng nhân viên kèm tên quản lý trực tiếp (`manager_id` tham chiếu `employees.id`).

```sql
SELECT emp.name AS employee, mgr.name AS manager
FROM employees emp
LEFT JOIN employees mgr ON mgr.id = emp.manager_id
ORDER BY emp.id;
```

`LEFT JOIN` (không phải `INNER JOIN`) vì CEO "An" không có manager — dùng `INNER JOIN` sẽ làm mất luôn dòng của CEO.

## 6. CROSS JOIN — sinh mọi tổ hợp có thể

**Bài toán**: tạo ma trận báo cáo đầy đủ mọi cặp (sản phẩm, thành phố khách hàng), kể cả cặp chưa từng phát sinh đơn hàng — dùng làm khung để `LEFT JOIN` dữ liệu thực tế vào (điền `0` chỗ chưa bán).

```sql
SELECT p.name AS product, c.city
FROM products p
CROSS JOIN (SELECT DISTINCT city FROM customers) c
ORDER BY p.name, c.city;
```

`CROSS JOIN` cho ra `số dòng bảng A × số dòng bảng B` — chỉ dùng khi thật sự cần toàn bộ tổ hợp (báo cáo dạng lưới, sinh lịch, sinh test data), tuyệt đối tránh vô tình tạo ra nó bằng cách quên điều kiện `ON` trong join thường.
