# Security analytics / SIEM

**Bài toán**: phát hiện bất thường trong log bảo mật (đăng nhập sai nhiều lần, truy cập bất thường, traffic lạ), correlation rule giữa nhiều nguồn log, threat hunting, phục vụ audit/compliance.

## Elastic Security hoạt động thế nào

Elastic Security là bộ tính năng dựng trên nền Elasticsearch, tận dụng chính khả năng full-text search + aggregation đã có:

- **Detection rules**: query định kỳ (vd: mỗi 5 phút) trên index log để tìm pattern bất thường (5 lần login sai trong 1 phút từ cùng IP → tạo alert).
- **Correlation**: join dữ liệu giữa nhiều nguồn log (firewall, endpoint, application) theo field chung (IP, user, trace_id) để phát hiện chuỗi hành vi đáng ngờ mà từng log riêng lẻ không lộ ra.
- **Threat hunting**: search thủ công, tự do trên toàn bộ log lịch sử — đây chính là use case full-text search ở quy mô lớn, real-time.

## So sánh chi phí — điểm khác biệt lớn nhất

Splunk tính phí theo **GB dữ liệu ingest mỗi ngày** — khi log bảo mật tăng (traffic lớn, nhiều thiết bị), chi phí license tăng gần như tuyến tính và có thể rất cao ở doanh nghiệp lớn. Elasticsearch (self-hosted hoặc Elastic Cloud) tính theo **tài nguyên hạ tầng (node/RAM)**, nên ở volume log lớn thường rẻ hơn đáng kể, đổi lại cần tự vận hành hoặc trả phí Elastic Cloud.

## So sánh với các công cụ khác

| Công cụ | Điểm mạnh | Điểm yếu |
|---|---|---|
| **Elastic Security (ES)** | Chi phí theo hạ tầng chứ không theo GB ingest, tận dụng full-text search mạnh sẵn có, tự host được | Cần tự cấu hình rule/tuning nhiều hơn so với sản phẩm SIEM chuyên biệt lâu năm |
| Splunk Enterprise Security | Rất mature, nhiều rule/use case dựng sẵn, hệ sinh thái app lớn | Chi phí license theo GB ingest rất cao ở scale lớn |
| IBM QRadar | Mạnh về compliance report, tích hợp sẵn nhiều chuẩn ngành | Triển khai/tùy biến nặng nề, chi phí license cao |

## Khi nào chọn gì

- **Elastic Security**: đã có sẵn hạ tầng ES (vd: dùng chung cho log management), muốn kiểm soát chi phí ở volume log lớn, chấp nhận tự cấu hình detection rule.
- **Splunk/QRadar**: cần compliance report/rule dựng sẵn theo chuẩn ngành cụ thể, ngân sách cho phép trả license cao để đổi lấy tính năng ra ngay.
