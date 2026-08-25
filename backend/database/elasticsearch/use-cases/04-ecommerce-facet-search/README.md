# E-commerce: search + facet filter kết hợp

**Bài toán**: trang tìm kiếm sản phẩm cần vừa xếp hạng theo độ liên quan (relevance), vừa cho phép filter nhiều chiều (giá, thương hiệu, đánh giá, vị trí kho...) **và** hiển thị số lượng sản phẩm khớp từng lựa chọn filter (facet count) — ví dụ Shopee/Lazada hiển thị "Giá dưới 100k (1,234)" ngay trên UI filter trước khi user bấm chọn.

## Vì sao đây là bài toán riêng, không chỉ là "search" đơn thuần

Facet count đòi hỏi tính **aggregation trên tập kết quả đã filter** trong cùng 1 lần query — nghĩa là vừa search full-text, vừa filter theo điều kiện hiện tại, vừa đồng thời đếm số lượng sản phẩm theo từng khoảng giá/thương hiệu khác **nếu áp thêm filter đó**. DB quan hệ làm được nhưng cần nhiều query `COUNT(*) ... GROUP BY` riêng biệt, chậm dần khi bảng lớn và nhiều chiều filter.

```json
GET /products/_search
{
  "query": { "match": { "name": "áo thun" } },
  "aggs": {
    "by_price_range": {
      "range": {
        "field": "price",
        "ranges": [
          { "to": 100000 }, { "from": 100000, "to": 300000 }, { "from": 300000 }
        ]
      }
    },
    "by_brand": { "terms": { "field": "brand.keyword", "size": 10 } }
  }
}
```

Kết quả trả về **đồng thời**: danh sách sản phẩm khớp "áo thun" + số lượng theo từng khoảng giá + số lượng theo từng thương hiệu — tất cả trong 1 round-trip.

## Ví dụ thực tế

Shopee/Lazada dùng search engine dạng ES-like cho trang tìm kiếm sản phẩm vì cần **aggregation facet** (đếm số sản phẩm theo từng khoảng giá/thương hiệu/đánh giá) đồng thời với **relevance ranking** theo từ khóa — bài toán mà cả DB quan hệ thuần lẫn cache đơn thuần đều không tối ưu ở quy mô hàng chục triệu SKU.

## So sánh cách tiếp cận

| Cách tiếp cận | Ưu điểm | Nhược điểm |
|---|---|---|
| **Elasticsearch aggregation** | 1 query trả cả kết quả + facet count, hiệu năng ổn định khi scale, cache được ở tầng shard | Cần đồng bộ dữ liệu sản phẩm từ DB chính sang ES (thêm độ trễ, thêm pipeline) |
| Nhiều query `COUNT() GROUP BY` trên RDBMS | Không cần thêm hệ thống, dữ liệu luôn tức thời (không lệch so với DB chính) | Nhiều round-trip, chậm dần khi bảng lớn + nhiều chiều filter, khó tối ưu index cho mọi tổ hợp filter |
| Denormalize/pre-compute count (cache riêng) | Đọc rất nhanh | Phức tạp để giữ đồng bộ khi filter kết hợp với từ khóa tìm kiếm tự do (số tổ hợp gần như vô hạn) |

## Khi nào chọn gì

- **Elasticsearch**: catalog lớn, nhiều chiều filter, cần facet count chính xác kết hợp full-text search theo từ khóa tự do.
- **RDBMS query trực tiếp**: catalog nhỏ/vừa, số chiều filter cố định ít, có thể tối ưu bằng composite index.
