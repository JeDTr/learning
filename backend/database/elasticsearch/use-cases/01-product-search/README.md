# Tìm kiếm sản phẩm / nội dung (site search)

**Bài toán**: tìm sản phẩm/bài viết theo từ khóa, có filter (giá, danh mục, tồn kho), sort theo độ liên quan, gợi ý autocomplete/"did you mean".

## Vì sao khó với `LIKE '%...%'` hoặc query đơn giản

- `LIKE '%áo thun%'` không tìm ra "áo phông" (đồng nghĩa) hay "áo thun" gõ sai chính tả thành "ao thun".
- Không có khái niệm **độ liên quan** — không thể xếp hạng "áo thun nam" lên trên "áo thun trẻ em" khi user gõ "áo thun".
- Filter kết hợp full-text (giá 100k-300k **và** chứa từ "cotton" **và** sort theo rating) khiến query SQL phức tạp dần và chậm khi bảng lớn.

## Cách Elasticsearch giải quyết

1. **Analyzer** tách "áo thun cotton" thành token `áo`, `thun`, `cotton` (sau khi lowercase, bỏ dấu câu, có thể thêm stemming).
2. **Inverted index**: mỗi token trỏ ngược tới danh sách document chứa nó → tìm theo từ khóa cực nhanh dù bảng có hàng chục triệu document.
3. **BM25 scoring**: tự động tính độ liên quan dựa trên tần suất từ trong document vs toàn bộ index, ưu tiên document khớp nhiều từ hơn/từ hiếm hơn.
4. **`bool` query** kết hợp `must` (full-text) + `filter` (giá, danh mục — không ảnh hưởng score, có cache) trong 1 lần gọi.

```json
GET /products/_search
{
  "query": {
    "bool": {
      "must": [{ "match": { "name": "áo thun cotton" } }],
      "filter": [
        { "range": { "price": { "gte": 100000, "lte": 300000 } } },
        { "term": { "in_stock": true } }
      ]
    }
  }
}
```

## So sánh với các công cụ khác

| Công cụ | Điểm mạnh | Điểm yếu / khi nào không hợp |
|---|---|---|
| **Elasticsearch** | Aggregation mạnh (facet filter), tự host, tùy biến sâu (custom analyzer, scoring), scale lớn | Vận hành cluster tốn công (JVM tuning, shard sizing), không có UI quản trị mặc định |
| PostgreSQL full-text search (`tsvector`) | Không cần thêm hệ thống, transaction cùng DB chính, đủ dùng cho dataset vừa (~vài triệu row) | Không có relevance tuning sâu, fuzzy/synonym yếu hơn, chậm dần khi dữ liệu lớn + query phức tạp |
| Algolia | Managed, độ trễ cực thấp (~vài chục ms), UI dashboard tốt, dev experience xuất sắc | Trả phí theo record + query (đắt ở scale lớn), ít tùy biến hạ tầng hơn |
| Meilisearch / Typesense | Nhẹ, dễ setup, mặc định tốt cho search "ra kết quả đúng ngay" không cần tuning nhiều | Aggregation/analytics yếu hơn ES, hệ sinh thái nhỏ hơn |
| Apache Solr | Cùng nền Lucene như ES, mature lâu đời | Cộng đồng/hệ sinh thái (Kibana, Beats...) kém hơn ES, ít được chọn cho dự án mới |

## Khi nào chọn gì

- **Elasticsearch**: dữ liệu lớn, cần cả full-text lẫn aggregation/filter phức tạp, muốn tự host và kiểm soát hạ tầng.
- **Postgres FTS**: dataset vừa, muốn giảm 1 hệ thống phải vận hành, chấp nhận tuning relevance hạn chế.
- **Algolia/Typesense**: ưu tiên tốc độ launch + trải nghiệm search UI mượt, ít nhân sự vận hành hạ tầng riêng.
