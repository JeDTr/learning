# IoT/Analytics — dữ liệu cảm biến theo thời gian

Mỗi cảm biến (nhiệt độ, độ ẩm, GPS...) gửi 1 bản ghi mỗi vài giây. Với 10.000 cảm biến gửi dữ liệu mỗi 5 giây, hệ thống nhận **~172 triệu bản ghi/ngày**. Nếu mỗi bản ghi là 1 document riêng, index (đặc biệt index theo thời gian) sẽ phình to rất nhanh, và insert rate cao liên tục tạo áp lực lớn lên B-tree index.

## Vấn đề với "1 document = 1 bản ghi"

```json
{ "_id": "...", "sensor_id": "s_042", "temperature": 28.4, "recorded_at": "2026-08-22T09:00:05Z" }
{ "_id": "...", "sensor_id": "s_042", "temperature": 28.5, "recorded_at": "2026-08-22T09:00:10Z" }
```

Về mặt logic đúng, nhưng **không hiệu quả ở quy mô lớn**: mỗi document tốn ~60-100 byte overhead (header BSON, `_id` riêng), và mỗi lần insert phải cập nhật index `{sensor_id, recorded_at}` — với insert rate hàng nghìn/giây, đây là điểm nghẽn ghi (write bottleneck) kinh điển.

## Thiết kế đề xuất — Bucket pattern

Gom nhiều lần đo trong **cùng 1 khoảng thời gian** (vd: 1 giờ) của **cùng 1 cảm biến** vào 1 document:

```json
{
  "_id": "s_042_2026082209",
  "sensor_id": "s_042",
  "bucket_start": "2026-08-22T09:00:00Z",
  "bucket_end": "2026-08-22T10:00:00Z",
  "measurement_count": 720,
  "readings": [
    { "t": "2026-08-22T09:00:05Z", "temperature": 28.4, "humidity": 61 },
    { "t": "2026-08-22T09:00:10Z", "temperature": 28.5, "humidity": 61 }
  ],
  "stats": {
    "temperature": { "min": 27.8, "max": 29.1, "avg": 28.4 },
    "humidity": { "min": 58, "max": 63, "avg": 61 }
  }
}
```

`_id` gộp `sensor_id` + giờ (`2026082209` = ngày 22/08/2026, giờ 09) — vừa là khoá chính, vừa tránh phải query phụ để tìm đúng bucket khi ghi dữ liệu mới:

```js
db.sensor_buckets.updateOne(
  { _id: "s_042_2026082209" },
  {
    $push: { readings: { t: new Date(), temperature: 28.6, humidity: 60 } },
    $inc: { measurement_count: 1 },
    $min: { "stats.temperature.min": 28.6 },
    $max: { "stats.temperature.max": 28.6 },
    $setOnInsert: { sensor_id: "s_042", bucket_start: ISODate("2026-08-22T09:00:00Z") },
  },
  { upsert: true }
)
```

## Quyết định thiết kế

- **1 bucket = 1 giờ dữ liệu của 1 sensor** — số lượng phần tử trong `readings` **có giới hạn tự nhiên** (720 phần tử/giờ nếu đo mỗi 5 giây), khác hẳn mảng comment/follower ở các use-case trước vốn không giới hạn. Đây là điều kiện tiên quyết để Bucket pattern an toàn — nếu tần suất đo không ổn định (có lúc dồn hàng chục nghìn lần đo/giờ), cần rút ngắn khoảng bucket (vd: 10 phút) để giữ mảng nhỏ.
- **`stats` tính sẵn trong lúc ghi** (bằng `$min`/`$max`, và `avg` cập nhật định kỳ) — dashboard hiển thị min/max/avg theo giờ không cần đọc lại toàn bộ mảng `readings` và tính lại mỗi lần, chỉ cần đọc field `stats`.
- **Giảm số document ~720 lần** so với "1 document/bản ghi" (720 lần đo gộp còn 1 document/giờ) — giảm tương ứng áp lực lên index, dù tổng dung lượng dữ liệu không đổi.

## Index

```js
db.sensor_buckets.createIndex({ sensor_id: 1, bucket_start: 1 })
```

Query "nhiệt độ cảm biến s_042 trong 24 giờ qua" — chỉ cần đọc 24 document (bucket) thay vì ~17.280 document nếu lưu riêng lẻ:

```js
db.sensor_buckets.find({
  sensor_id: "s_042",
  bucket_start: { $gte: ISODate("2026-08-21T09:00:00Z") },
}).sort({ bucket_start: 1 })
```

## Thay thế: MongoDB Time Series Collection (5.0+)

Từ MongoDB 5.0, có loại collection chuyên dụng **`timeseries`** tự động áp dụng bucketing dưới nền (transparent với ứng dụng — vẫn insert từng bản ghi như bình thường, MongoDB tự gom bucket):

```js
db.createCollection("sensor_readings", {
  timeseries: {
    timeField: "recorded_at",
    metaField: "sensor_id",
    granularity: "seconds",
  },
})

db.sensor_readings.insertOne({
  sensor_id: "s_042",
  temperature: 28.6,
  humidity: 60,
  recorded_at: new Date(),
})
```

**Nên dùng Time Series Collection thay vì tự implement Bucket pattern thủ công** khi dùng MongoDB 5.0+, trừ khi cần kiểm soát chi tiết cấu trúc bucket (vd: tính sẵn `stats` như ví dụ trên) mà tính năng có sẵn chưa đáp ứng đủ. Time Series Collection còn tự động nén dữ liệu (columnar compression) và hỗ trợ retention policy (tự xoá dữ liệu cũ theo `expireAfterSeconds`) — 2 việc phải tự xây nếu bucket thủ công.

## Điểm thiết kế đáng chú ý

- Bucket pattern (thủ công hoặc qua Time Series Collection) là lựa chọn MongoDB cho bài toán mà Column-Family DB (Cassandra) hoặc Time-Series DB chuyên dụng (InfluxDB, TimescaleDB) thường được nhắc tới đầu tiên — xem so sánh ở [../../../nosql/README.md](../../../nosql/README.md#12-document-database). MongoDB Time Series Collection là câu trả lời của MongoDB cho use case này, không cần thêm 1 hệ database riêng nếu tải không ở mức petabyte.
- Update liên tục vào cùng 1 document bucket (`$push` mỗi vài giây) tạo **write contention** trên đúng 1 document nếu nhiều tiến trình cùng ghi 1 sensor cùng lúc — thực tế hiếm xảy ra vì mỗi sensor thường chỉ có 1 nguồn ghi, nhưng cần lưu ý nếu thiết kế lại theo bucket dùng chung nhiều nguồn ghi.
- Không dùng bucket cho dữ liệu cần sửa/xoá từng bản ghi lẻ thường xuyên (vd: log giao dịch cần audit từng dòng) — bucket tối ưu cho ghi tuần tự, đọc theo khoảng thời gian, không tối ưu cho truy cập ngẫu nhiên từng phần tử.

## Ví dụ dùng Mongoose (Node.js) với Time Series Collection

```typescript
import { Schema, model } from 'mongoose';

const sensorReadingSchema = new Schema(
  {
    sensorId: { type: String, required: true },
    temperature: Number,
    humidity: Number,
    recordedAt: { type: Date, required: true },
  },
  {
    timeseries: {
      timeField: 'recordedAt',
      metaField: 'sensorId',
      granularity: 'seconds',
    },
  },
);

export const SensorReading = model('SensorReading', sensorReadingSchema);

// insert bình thường — MongoDB tự gom bucket dưới nền
await SensorReading.create({ sensorId: 's_042', temperature: 28.6, humidity: 60, recordedAt: new Date() });
```
