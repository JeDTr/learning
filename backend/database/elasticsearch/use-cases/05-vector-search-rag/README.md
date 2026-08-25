# Vector search / RAG (semantic search)

**Bài toán**: tìm document theo độ **tương đồng ngữ nghĩa** (không phải khớp từ khóa chính xác) — nền tảng cho chatbot RAG (Retrieval-Augmented Generation), semantic search, gợi ý nội dung tương tự.

## Cách hoạt động

1. Mỗi document (đoạn text, sản phẩm...) được chuyển thành **vector embedding** (mảng số thực, vd 768/1536 chiều) qua model embedding (OpenAI, Cohere, sentence-transformers...).
2. Vector lưu vào field kiểu `dense_vector` trong Elasticsearch.
3. Khi query, câu hỏi của user cũng được embed thành vector, rồi tìm **k document có vector gần nhất** (approximate kNN — dùng thuật toán HNSW để không phải so sánh tuần tự toàn bộ dataset).

```json
PUT /articles
{
  "mappings": {
    "properties": {
      "content": { "type": "text" },
      "content_vector": { "type": "dense_vector", "dims": 768, "index": true, "similarity": "cosine" }
    }
  }
}

GET /articles/_search
{
  "knn": {
    "field": "content_vector",
    "query_vector": [0.021, -0.13, ...],
    "k": 5,
    "num_candidates": 50
  }
}
```

## Điểm mạnh riêng: Hybrid search

Khác với vector DB thuần, Elasticsearch cho phép **kết hợp full-text (BM25) + vector search trong cùng 1 query** — hữu ích khi câu hỏi vừa có từ khóa cụ thể (tên riêng, mã sản phẩm) vừa cần hiểu ngữ nghĩa xung quanh. Đây là pattern phổ biến trong hệ thống RAG chất lượng cao thay vì chỉ dùng vector search đơn thuần.

## So sánh với các công cụ khác

| Công cụ | Điểm mạnh | Điểm yếu |
|---|---|---|
| **Elasticsearch (dense_vector + kNN)** | Hybrid search (full-text + vector trong 1 query) rất mạnh, tận dụng hạ tầng ES sẵn có nếu đã dùng cho search khác | Chưa chuyên sâu bằng vector DB thuần, phí license/tài nguyên nếu chỉ cần vector search |
| Pinecone / Weaviate / Milvus | Chuyên biệt cho vector, hiệu năng ANN tối ưu hơn ở scale cực lớn (hàng tỷ vector) | Không mạnh về full-text/aggregation truyền thống, thêm 1 hệ thống riêng cần đồng bộ |
| pgvector (Postgres extension) | Không cần thêm hệ thống nếu đã dùng Postgres, đủ dùng ở scale vừa | ANN performance kém hơn các engine chuyên biệt ở dataset rất lớn |

## Khi nào chọn gì

- **Elasticsearch**: cần **hybrid search** (kết hợp keyword + semantic) trong cùng 1 query, đã có hạ tầng ES cho search khác, không muốn merge kết quả từ 2 hệ thống riêng.
- **Vector DB chuyên biệt (Pinecone/Milvus/Weaviate)**: dataset vector cực lớn, chỉ cần vector search thuần túy (không cần full-text), ưu tiên hiệu năng ANN tối đa.
- **pgvector**: đã dùng Postgres làm DB chính, dataset vector vừa phải, muốn tránh thêm hệ thống.
