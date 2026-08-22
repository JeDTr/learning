# SQL nâng cao — Use case & bài toán query

Trong khi [../rdbms/](../rdbms/README.md) tập trung vào **thiết kế schema** (ERD, DDL, ràng buộc), thư mục này tập trung vào **kỹ năng viết query**: JOIN nâng cao, aggregation phức tạp, window function, subquery/CTE, và các bài toán tổng hợp thường gặp khi phỏng vấn hoặc làm báo cáo thực tế.

Toàn bộ bài tập dùng chung 1 schema PostgreSQL ở [schema/seed.sql](schema/seed.sql) — gồm domain HR (`departments`/`employees`, có self-reference `manager_id`) và domain Shop (`customers`/`products`/`orders`/`order_items`), cố ý cài sẵn các "lỗ hổng" dữ liệu (nhân viên chưa có phòng ban, phòng ban chưa có ai, khách hàng chưa từng mua hàng, đơn hàng liên tiếp ngày...) để các bài JOIN/subquery có ý nghĩa thực tế thay vì chỉ chạy trên dữ liệu hoàn hảo.

## Mục lục

1. [JOIN nâng cao](01-joins/README.md) — INNER/LEFT/RIGHT/FULL OUTER/SELF/CROSS JOIN, anti-join (tìm bản ghi mồ côi)
2. [Aggregation nâng cao](02-aggregation/README.md) — GROUP BY nhiều cột, HAVING, `FILTER`, `ROLLUP`/`GROUPING SETS`, `COUNT(DISTINCT)`
3. [Window Functions](03-window-functions/README.md) — `ROW_NUMBER`/`RANK`/`DENSE_RANK`, top-N mỗi nhóm, `LAG`/`LEAD`, running total, moving average, `NTILE`
4. [Subquery & CTE](04-subquery-cte/README.md) — correlated subquery, `EXISTS` vs `IN` vs `JOIN`, `WITH`, Recursive CTE (cây tổ chức)
5. [Set operations & bài toán tổng hợp](05-set-ops-advanced/README.md) — `UNION`/`INTERSECT`/`EXCEPT`, PIVOT thủ công, gaps & islands, điền khoảng ngày thiếu
6. [Composite Index](06-indexing/README.md) — leftmost-prefix rule, thứ tự cột, chứng minh bằng `EXPLAIN ANALYZE` thật trên 300k dòng

## Cách dùng

```bash
psql -U postgres -d your_db -f schema/seed.sql
```

Sau đó copy từng query trong các file trên vào chạy thử, đổi điều kiện/dữ liệu để tự kiểm tra hiểu đúng chưa trước khi xem giải thích.

## Bảng tổng hợp — chọn kỹ thuật nào cho bài toán nào

| Cần làm gì | Kỹ thuật | Chi tiết |
|---|---|---|
| Giữ lại bản ghi không khớp ở 1 hoặc cả 2 bên | `LEFT`/`RIGHT`/`FULL OUTER JOIN` | [01](01-joins/README.md) |
| Tìm bản ghi "không tồn tại quan hệ" (VD: khách chưa mua hàng) | `LEFT JOIN ... WHERE NULL` hoặc `NOT EXISTS` | [01](01-joins/README.md#2-tìm-bản-ghi-mồ-côi-bằng-left-join--is-null-anti-join) |
| So sánh 1 dòng với dòng "cha" của chính nó (VD: nhân viên - quản lý) | `SELF JOIN` hoặc Recursive CTE | [01](01-joins/README.md#5-self-join--nối-bảng-với-chính-nó), [04](04-subquery-cte/README.md#4-recursive-cte--duyệt-cấu-trúc-câyđồ-thị) |
| Nhiều mức tổng hợp (subtotal + grand total) trong 1 query | `ROLLUP`/`GROUPING SETS` | [02](02-aggregation/README.md#4-grouping-sets--rollup--nhiều-mức-tổng-hợp-trong-1-query) |
| Đếm/tổng theo nhiều điều kiện trong cùng 1 dòng | `FILTER` / `CASE WHEN` | [02](02-aggregation/README.md#3-filter--aggregate-có-điều-kiện-thay-cho-case-when-lồng-trong-sum) |
| Top-N mỗi nhóm | `ROW_NUMBER() OVER (PARTITION BY ...)` | [03](03-window-functions/README.md#2-top-n-theo-từng-nhóm-pattern-rất-hay-gặp) |
| Xếp hạng (có thể trùng hạng) | `RANK`/`DENSE_RANK` | [03](03-window-functions/README.md#1-rank-vs-dense_rank-vs-row_number) |
| So sánh với kỳ trước (MoM, WoW) | `LAG`/`LEAD` | [03](03-window-functions/README.md#3-lag--lead--so-sánh-với-dòng-trướcsau) |
| Tổng luỹ kế / trung bình trượt | `SUM()`/`AVG() OVER (ROWS BETWEEN ...)` | [03](03-window-functions/README.md#4-running-total-tổng-dồn) |
| Điều kiện phụ thuộc từng dòng đang xét | Correlated subquery hoặc window function | [04](04-subquery-cte/README.md#1-correlated-subquery--subquery-phụ-thuộc-vào-từng-dòng-ngoài) |
| Chia nhỏ query phức tạp để dễ đọc/debug | CTE (`WITH`) | [04](04-subquery-cte/README.md#3-cte-with--đặt-tên-cho-subquery-để-dễ-đọc-và-tái-sử-dụng) |
| Duyệt cây/đồ thị (org chart, category tree) | `WITH RECURSIVE` | [04](04-subquery-cte/README.md#4-recursive-cte--duyệt-cấu-trúc-câyđồ-thị) |
| Chuyển dữ liệu dạng hàng thành cột | PIVOT thủ công (`SUM(CASE WHEN...)`) | [05](05-set-ops-advanced/README.md#3-pivot-thủ-công-bằng-case-when--aggregate) |
| Tìm chuỗi liên tiếp (ngày, số thứ tự) | Gaps & islands (`ROW_NUMBER` trừ ngày) | [05](05-set-ops-advanced/README.md#4-gaps--islands--tìm-chuỗi-ngày-liên-tiếp) |
| Lấp đầy khoảng thời gian bị thiếu dữ liệu | `generate_series` + `LEFT JOIN` | [05](05-set-ops-advanced/README.md#5-điền-đủ-khoảng-ngày-bị-thiếu-dùng-cross-join--generate_series) |
| Tăng tốc query lọc theo nhiều cột cùng lúc | Composite index (đúng thứ tự cột, leftmost-prefix) | [06](06-indexing/README.md) |

## Lưu ý PostgreSQL vs MySQL

Các bài trên ưu tiên cú pháp PostgreSQL (nhất quán với [../rdbms/](../rdbms/README.md)); khác biệt đáng chú ý với MySQL được ghi chú tại chỗ — xem thêm [../rdbms/mysql-vs-postgres/README.md](../rdbms/mysql-vs-postgres/README.md) để so sánh sâu hơn 2 hệ quản trị này.
