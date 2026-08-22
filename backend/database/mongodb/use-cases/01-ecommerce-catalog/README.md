# Catalog sản phẩm E-commerce

Mỗi ngành hàng có thuộc tính khác nhau (áo có size/màu, điện thoại có RAM/dung lượng, sách có tác giả/số trang) — nếu dùng RDBMS, mỗi ngành hàng cần 1 bảng riêng hoặc bảng `EAV` (Entity-Attribute-Value) rất khó tối ưu. Ngoài ra sản phẩm có review từ khách hàng, nhưng review có thể lên tới hàng chục nghìn/sản phẩm — không thể nhúng toàn bộ vào document sản phẩm.

So sánh với thiết kế RDBMS cùng bài toán: [../../../rdbms/use-cases/01-ecommerce-order/README.md](../../../rdbms/use-cases/01-ecommerce-order/README.md) (tập trung vào transaction đặt hàng, không phải catalog).

## Document schema

```json
{
  "_id": "prod_5f8a1",
  "sku": "AT-DEN-M",
  "name": "Áo thun cotton",
  "category": "ao-nam",
  "price": 199000,
  "currency": "VND",
  "stock_qty": 120,

  "attributes": [
    { "key": "size", "value": "M" },
    { "key": "color", "value": "đen" },
    { "key": "material", "value": "cotton 100%" }
  ],

  "review_summary": {
    "avg_rating": 4.6,
    "count": 8342
  },
  "recent_reviews": [
    {
      "review_id": "rv_9012",
      "user_id": "u_2201",
      "rating": 5,
      "comment": "Vải mát, form chuẩn",
      "created_at": "2026-08-15T10:00:00Z"
    }
  ],

  "created_at": "2025-01-10T00:00:00Z",
  "updated_at": "2026-08-20T03:12:00Z"
}
```

Collection riêng cho toàn bộ review (không giới hạn số lượng):

```json
{
  "_id": "rv_9012",
  "product_id": "prod_5f8a1",
  "user_id": "u_2201",
  "rating": 5,
  "comment": "Vải mát, form chuẩn",
  "created_at": "2026-08-15T10:00:00Z"
}
```

## Quyết định thiết kế

- **Attribute pattern cho `attributes`**: thay vì mỗi thuộc tính là 1 field riêng (`size`, `color`, `ram`, `storage`...) — vốn khác nhau theo từng ngành hàng và không thể index hết — gom vào mảng `{key, value}`. Chỉ cần **1 index duy nhất** trên `attributes.key` + `attributes.value` là filter được theo mọi thuộc tính, kể cả thuộc tính mới thêm sau này mà không cần đổi schema hay thêm index.
- **Subset pattern cho review**: document sản phẩm chỉ nhúng `review_summary` (số liệu tổng hợp, đọc cực nhanh khi hiển thị trang sản phẩm) và `recent_reviews` (vài review mới nhất, giới hạn cứng ví dụ 5 phần tử). Toàn bộ review nằm ở collection `reviews` riêng, query theo `product_id` khi user bấm "xem tất cả đánh giá". Đây là lý do **không nhúng toàn bộ mảng review** — review tăng không giới hạn, nhúng hết sẽ vi phạm giới hạn 16MB và làm chậm mọi lần đọc/ghi sản phẩm (kể cả khi chỉ cần đổi giá).
- **`review_summary` là dữ liệu denormalize có chủ đích**: cập nhật mỗi khi có review mới (qua application code hoặc MongoDB Change Stream chạy nền), đổi lại tránh phải aggregate hàng nghìn review mỗi lần hiển thị trang sản phẩm.

## Index

```js
db.products.createIndex({ category: 1, price: 1 })
db.products.createIndex({ "attributes.key": 1, "attributes.value": 1 })
db.products.createIndex({ sku: 1 }, { unique: true })

db.reviews.createIndex({ product_id: 1, created_at: -1 })
```

Index `attributes.key` + `attributes.value` là **multikey index** — MongoDB tự động index từng phần tử trong mảng, cho phép query kiểu:

```js
db.products.find({
  category: "ao-nam",
  attributes: { $elemMatch: { key: "size", value: "M" } }
})
```

## Điểm thiết kế đáng chú ý

- Đánh đổi của Attribute pattern: filter nhiều điều kiện thuộc tính cùng lúc (vd: size=M **và** color=đen) phức tạp hơn field riêng — cần nhiều `$elemMatch` hoặc `$and`, và **không thể** dùng 1 compound index để tối ưu đồng thời nhiều cặp key/value như khi mỗi thuộc tính là field riêng. Đây là đánh đổi chấp nhận được khi số ngành hàng/thuộc tính lớn và thay đổi liên tục — nếu chỉ có vài thuộc tính cố định (vd: chỉ bán áo, luôn có size/color), field riêng vẫn đơn giản và nhanh hơn.
- `stock_qty` giảm dần khi có đơn hàng: MongoDB không có transaction đa bảng mạnh như RDBMS theo mặc định, nên tránh oversell cần `findOneAndUpdate` với điều kiện `stock_qty: { $gte: quantity }` — atomic ở cấp 1 document, không cần transaction:

```js
db.products.findOneAndUpdate(
  { _id: "prod_5f8a1", stock_qty: { $gte: 2 } },
  { $inc: { stock_qty: -2 } }
)
```

Nếu kết quả trả về `null` — nghĩa là không đủ tồn kho, ứng dụng phải tự xử lý (khác RDBMS nơi `CHECK` constraint chặn ở tầng DB).

## Ví dụ schema Mongoose (Node.js)

```typescript
import { Schema, model } from 'mongoose';

const attributeSchema = new Schema(
  { key: { type: String, required: true }, value: { type: String, required: true } },
  { _id: false },
);

const productSchema = new Schema({
  sku: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true, index: true },
  price: { type: Number, required: true },
  stockQty: { type: Number, required: true, min: 0 },
  attributes: [attributeSchema],
  reviewSummary: {
    avgRating: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
  },
  recentReviews: {
    type: [{ reviewId: String, userId: String, rating: Number, comment: String, createdAt: Date }],
    validate: (arr: unknown[]) => arr.length <= 5, // giữ subset nhỏ, không cho phình to
  },
}, { timestamps: true });

productSchema.index({ 'attributes.key': 1, 'attributes.value': 1 });

export const Product = model('Product', productSchema);
```
