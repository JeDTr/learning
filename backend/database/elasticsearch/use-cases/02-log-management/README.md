# Log management / Observability

**Bài toán**: thu thập log từ hàng trăm service, tìm kiếm/filter theo thời gian thực khi debug incident, dashboard giám sát.

## Kiến trúc điển hình (ELK / EFK Stack)

```
App/Service ──► Filebeat/Fluentd ──► Logstash (parse/enrich) ──► Elasticsearch ──► Kibana (dashboard)
                (thu thập log)         (transform, optional)      (index + search)   (visualize)
```

- **Beats/Fluentd**: agent nhẹ chạy trên mỗi host, đọc log file/stdout rồi đẩy đi.
- **Logstash** (tùy chọn): parse log thô (regex/grok) thành field có cấu trúc trước khi index — có thể bỏ qua nếu log đã ở dạng JSON.
- **Elasticsearch**: lưu log dưới dạng document có timestamp, cho phép search full-text trong nội dung log + filter theo field (service, level, trace_id...).
- **Kibana**: dashboard, "Discover" để search log thủ công khi debug incident.

## Vì sao cần search full-text trong log (không chỉ label)

Khi debug 1 lỗi production, thường chỉ có 1 đoạn stack trace hoặc message lỗi cụ thể (vd: `"connection timeout to redis-primary"`) — cần search **theo nội dung**, không chỉ filter theo `service=payment` rồi đọc thủ công hàng nghìn dòng. Đây là điểm khác biệt lớn nhất so với các hệ thống chỉ index theo label.

## Quản lý dung lượng: Index Lifecycle Management (ILM)

Log tăng liên tục — cần chính sách tự động:

```
Hot (ghi liên tục, SSD nhanh) → Warm (ít query hơn, disk rẻ hơn) → Cold → Delete sau N ngày
```

ILM tự động chuyển index cũ qua các giai đoạn và xóa sau retention period, tránh cluster phình to vô hạn.

## So sánh với các công cụ khác

| Công cụ | Điểm mạnh | Điểm yếu |
|---|---|---|
| **ELK/EFK Stack** | Full-text search trên log rất mạnh, dashboard tùy biến cao, tự host = kiểm soát chi phí ở scale lớn | Chi phí vận hành cluster + storage (log tăng nhanh), cần tự lo retention/ILM |
| Splunk | Mạnh về enterprise feature, SPL query language mạnh, hỗ trợ tốt | Chi phí license rất cao (tính theo GB ingest/ngày) |
| Grafana Loki | Chỉ index label (không index full text) → rẻ hơn, nhẹ hơn nhiều | Full-text search trong log content chậm hơn ES vì phải grep, không hợp khi cần search sâu nội dung log |
| Datadog / New Relic (SaaS) | Managed hoàn toàn, tích hợp APM + metrics + log trong 1 chỗ | Chi phí SaaS tăng nhanh theo volume, dữ liệu ra ngoài hạ tầng công ty |

## Khi nào chọn gì

- **ELK/EFK**: muốn **tự host**, cần **search log theo nội dung** sâu (không chỉ theo label như Loki), có đội vận hành hạ tầng.
- **Loki**: ưu tiên chi phí thấp, chủ yếu filter theo label (service, pod, level), ít cần full-text search sâu.
- **Splunk/Datadog**: sẵn sàng trả chi phí SaaS/license để đổi lấy vận hành managed hoàn toàn, cần feature enterprise (compliance, support).
