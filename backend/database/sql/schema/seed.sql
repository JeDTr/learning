-- Schema & seed data dùng chung cho toàn bộ bài tập trong backend/database/sql/
-- PostgreSQL. Chạy 1 lần trước khi thử các query ở từng thư mục 01-05.
--
-- Gồm 2 domain nhỏ, cố ý cài "lỗ hổng" dữ liệu để các bài JOIN/subquery có ý nghĩa:
--   1. HR: departments / employees (self-reference manager_id) -> self-join, recursive CTE, ranking lương
--   2. Shop: customers / products / orders / order_items -> outer join, aggregation, running total

DROP TABLE IF EXISTS order_items, orders, products, customers, employees, departments CASCADE;

-- ========== Domain 1: HR ==========

CREATE TABLE departments (
    id      SERIAL PRIMARY KEY,
    name    TEXT NOT NULL UNIQUE
);

CREATE TABLE employees (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    department_id   INT REFERENCES departments(id),   -- NULL cho phép: nhân viên chưa gán phòng ban
    manager_id      INT REFERENCES employees(id),      -- NULL = không có manager (CEO)
    salary          NUMERIC(12,2) NOT NULL,
    hire_date       DATE NOT NULL
);

INSERT INTO departments (id, name) VALUES
    (1, 'Engineering'),
    (2, 'Sales'),
    (3, 'HR'),
    (4, 'Marketing'); -- không có nhân viên nào -> demo LEFT/RIGHT JOIN phòng ban rỗng

INSERT INTO employees (id, name, department_id, manager_id, salary, hire_date) VALUES
    (1, 'An (CEO)',        NULL, NULL, 5000, '2015-01-10'),
    (2, 'Binh (CTO)',      1,    1,    4200, '2016-03-01'),
    (3, 'Chi (VP Sales)',  2,    1,    4000, '2016-06-15'),
    (4, 'Duy',             1,    2,    3200, '2018-02-20'),
    (5, 'Em',              1,    2,    3300, '2019-05-11'),
    (6, 'Phong',           1,    2,    2900, '2021-07-01'),
    (7, 'Giang',           2,    3,    2600, '2019-09-09'),
    (8, 'Hoa',             2,    3,    2700, '2020-01-15'),
    (9, 'Khanh',           3,    1,    2400, '2017-04-01'),
    (10,'Lan',             NULL, NULL, 2800, '2022-08-01'); -- chưa gán phòng ban -> demo FULL OUTER JOIN / anti-join

-- ========== Domain 2: Shop ==========

CREATE TABLE customers (
    id      SERIAL PRIMARY KEY,
    name    TEXT NOT NULL,
    city    TEXT NOT NULL
);

CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    price       NUMERIC(12,2) NOT NULL
);

CREATE TABLE orders (
    id              SERIAL PRIMARY KEY,
    customer_id     INT NOT NULL REFERENCES customers(id),
    order_date      DATE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('completed','cancelled','pending'))
);

CREATE TABLE order_items (
    id              SERIAL PRIMARY KEY,
    order_id        INT NOT NULL REFERENCES orders(id),
    product_id      INT NOT NULL REFERENCES products(id),
    quantity        INT NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(12,2) NOT NULL
);

INSERT INTO customers (id, name, city) VALUES
    (1, 'Nguyen Van A', 'Ha Noi'),
    (2, 'Tran Thi B',   'Ho Chi Minh'),
    (3, 'Le Van C',     'Da Nang'),
    (4, 'Pham Thi D',   'Ha Noi'),
    (5, 'Hoang Van E',  'Ho Chi Minh'); -- chưa từng đặt đơn nào -> demo "khách hàng chưa mua hàng"

INSERT INTO products (id, name, category, price) VALUES
    (1, 'Laptop X1',        'Electronics', 1200),
    (2, 'Wireless Mouse',   'Electronics', 25),
    (3, 'Mechanical KB',    'Electronics', 80),
    (4, 'Office Chair',     'Furniture',   150),
    (5, 'Standing Desk',    'Furniture',   350),
    (6, 'Notebook',         'Stationery',  3);

INSERT INTO orders (id, customer_id, order_date, status) VALUES
    (1, 1, '2026-01-05', 'completed'),
    (2, 1, '2026-01-06', 'completed'),  -- 2 đơn liên tiếp cùng khách, ngày liền kề -> demo gaps & islands
    (3, 2, '2026-01-08', 'completed'),
    (4, 3, '2026-02-01', 'completed'),
    (5, 1, '2026-02-15', 'cancelled'),  -- đơn bị huỷ -> demo lọc theo status khi tính doanh thu
    (6, 4, '2026-02-20', 'completed'),
    (7, 2, '2026-03-01', 'completed'),
    (8, 3, '2026-03-03', 'completed'),
    (9, 1, '2026-03-10', 'completed'),
    (10,4, '2026-03-12', 'pending');

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 1, 1, 1200), (1, 2, 2, 25),
    (2, 3, 1, 80),
    (3, 4, 2, 150),
    (4, 1, 1, 1200), (4, 5, 1, 350),
    (5, 2, 1, 25),
    (6, 6, 10, 3),
    (7, 2, 3, 25), (7, 3, 1, 80),
    (8, 5, 1, 350),
    (9, 1, 1, 1200), (9, 6, 5, 3),
    (10,4, 1, 150);
