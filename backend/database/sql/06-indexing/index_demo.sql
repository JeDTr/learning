-- Dữ liệu riêng cho bài composite index — 300k dòng ngẫu nhiên.
-- Bảng orders/order_items ở ../schema/seed.sql chỉ có vài chục dòng nên PostgreSQL
-- luôn chọn Seq Scan (Seq Scan trên bảng nhỏ NHANH HƠN dùng index) -> không thể
-- chứng minh index hoạt động thế nào. Cần bảng đủ lớn để thấy khác biệt thật.

DROP TABLE IF EXISTS orders_bulk;

CREATE TABLE orders_bulk (
    id           BIGSERIAL PRIMARY KEY,
    customer_id  INT NOT NULL,
    order_date   DATE NOT NULL,
    status       TEXT NOT NULL
);

INSERT INTO orders_bulk (customer_id, order_date, status)
SELECT (random() * 5000)::int + 1,                              -- 5000 khách hàng khác nhau
       DATE '2020-01-01' + (random() * 2000)::int,               -- trải trong ~5.5 năm
       (ARRAY['completed','cancelled','pending'])[floor(random()*3 + 1)]
FROM generate_series(1, 300000);

ANALYZE orders_bulk;
