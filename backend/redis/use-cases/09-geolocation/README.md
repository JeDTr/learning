# Geo-location

Tìm địa điểm gần nhất — ví dụ app giao đồ ăn tìm shipper gần nhất, app tìm cửa hàng gần vị trí user.

## Ví dụ

```
GEOADD shippers 106.6297 10.8231 "shipper:1"
GEOADD shippers 106.6301 10.8235 "shipper:2"

GEOSEARCH shippers FROMLONLAT 106.6298 10.8230 BYRADIUS 2 km ASC
GEODIST shippers "shipper:1" "shipper:2" km
```

- `GEOADD` lưu tọa độ (longitude, latitude) dưới dạng Sorted Set nội bộ.
- `GEOSEARCH` (thay thế cho `GEORADIUS` cũ) tìm các điểm trong bán kính cho trước, sắp xếp theo khoảng cách.
- `GEODIST` tính khoảng cách giữa 2 điểm đã lưu.

## Use case

- Tìm shipper/tài xế gần nhất để nhận đơn.
- Tìm cửa hàng/chi nhánh gần vị trí user.
- Kết hợp với TTL/update liên tục vì vị trí luôn thay đổi theo thời gian thực.

## Giải pháp thay thế Redis

| Giải pháp | Ưu điểm | Nhược điểm | Khi nào nên dùng |
|---|---|---|---|
| **PostGIS** (extension của Postgres) | Query địa lý mạnh mẽ (polygon, khoảng cách chính xác theo hệ tọa độ trái đất), kết hợp trực tiếp với dữ liệu quan hệ khác | Chậm hơn Redis cho dữ liệu update liên tục tần suất cao (vị trí shipper di chuyển từng giây) | Dữ liệu địa lý ít thay đổi (cửa hàng, khu vực giao hàng), cần query phức tạp (trong vùng polygon, join với dữ liệu khác) |
| **Elasticsearch (geo queries)** | Kết hợp tốt geo-search với full-text/filter phức tạp, scale tốt | Không real-time bằng Redis, vận hành phức tạp hơn | Cần tìm kiếm kết hợp nhiều tiêu chí (địa điểm + từ khóa + filter) |
| **MongoDB geospatial index** (`2dsphere`) | Tích hợp sẵn nếu đã dùng MongoDB làm DB chính, hỗ trợ query polygon | Không nhanh bằng Redis cho vị trí cập nhật liên tục tần suất rất cao | Đã dùng MongoDB, dữ liệu vị trí không cần cập nhật mỗi giây |
| **Third-party Maps API** (Google Maps, Mapbox) | Không cần tự quản lý dữ liệu bản đồ/khoảng cách chính xác theo đường đi thực tế | Tốn phí theo request, phụ thuộc bên thứ ba, độ trễ mạng | Cần khoảng cách/thời gian di chuyển thực tế (không phải đường chim bay) |

**Khi nào chọn Redis**: vị trí thay đổi liên tục (tài xế/shipper di chuyển real-time), cần tìm kiếm bán kính cực nhanh với lượng update cao.

## Ví dụ triển khai theo framework

API mẫu: cập nhật vị trí shipper (`GEOADD`), tìm shipper gần 1 điểm trong bán kính cho trước (`GEOSEARCH`).

- [Python — FastAPI](examples/fastapi_example.py) (`redis.asyncio`)
- [PHP — Laravel](examples/laravel_example.php) (`Illuminate\Support\Facades\Redis`, package `predis/predis`)
- [Node.js — NestJS](examples/nestjs_example.ts) (`ioredis`)

Cả 3 đều dùng chung key `shippers` (Sorted Set địa lý nội bộ của Redis).
