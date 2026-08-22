# Mạng xã hội — follow/feed

User có thể follow user khác, và cần xem feed các bài viết từ người mình follow. Đa số user có vài trăm follower — embed được. Nhưng **celebrity account** có thể có hàng chục triệu follower — nhúng thẳng vào document user sẽ vượt xa giới hạn 16MB. Đây là bài toán kinh điển cho **Outlier pattern**.

## Vấn đề với embed đồng nhất

```json
{
  "_id": "u_1",
  "username": "an_nguyen",
  "followers": ["u_2", "u_3", "u_4", "..."]
}
```

Với user thường (vài trăm follower), cách này ổn. Nhưng nếu `u_1` là celebrity với 20 triệu follower, mảng `followers` (mỗi phần tử ~12 byte ObjectId) đã chiếm ~240MB — vượt giới hạn 16MB nhiều lần, và **mọi thao tác trên document này** (kể cả chỉ đổi avatar) đều phải đọc/ghi lại cả mảng khổng lồ đó.

## Thiết kế đề xuất — Outlier pattern

```json
// users — collection chính, đa số document nhỏ gọn
{
  "_id": "u_1",
  "username": "an_nguyen",
  "avatar_url": "https://cdn.../u1.jpg",
  "follower_count": 20456123,
  "followers_preview": ["u_2", "u_3", "u_4"], // vài follower gần nhất, chỉ để hiển thị nhanh
  "has_extra_followers": true // đánh dấu outlier — followers đầy đủ nằm ở collection khác
}
```

```json
// follows — collection riêng, lưu MỌI quan hệ follow (không chỉ của outlier)
{
  "_id": "f_88213",
  "follower_id": "u_2",
  "followee_id": "u_1",
  "created_at": "2026-08-20T08:00:00Z"
}
```

```json
// posts — dùng Extended Reference pattern để feed không cần join sang users mỗi lần đọc
{
  "_id": "post_5001",
  "author": {
    "user_id": "u_1",
    "username": "an_nguyen", // nhúng sẵn field hay đọc, tránh phải $lookup sang users
    "avatar_url": "https://cdn.../u1.jpg"
  },
  "content": "Chào mọi người!",
  "created_at": "2026-08-22T09:00:00Z"
}
```

## Quyết định thiết kế

- **`follows` luôn là collection riêng cho mọi user**, không chỉ outlier — vì số lượng follow **luôn không có giới hạn tự nhiên** ngay từ đầu (giống lý do chọn Referencing ở [use-case comment](../02-blog-cms/README.md)). `followers_preview` trong `users` chỉ là **cache hiển thị** (vài phần tử để show nhanh trên trang profile), không phải nguồn dữ liệu chính — nguồn thật luôn là collection `follows`.
- **`has_extra_followers` + `follower_count`** là dấu hiệu Outlier pattern: ứng dụng đọc `follower_count` để hiển thị số liệu (không cần đọc hết danh sách), và chỉ khi user bấm "xem danh sách follower" mới query sang `follows` với phân trang — tránh tải toàn bộ hàng chục triệu bản ghi cùng lúc dù là celebrity hay user thường.
- **`post.author` dùng Extended Reference pattern**: nhúng sẵn `username`, `avatar_url` — 2 field gần như luôn cần hiển thị cùng bài viết trên feed. Đánh đổi: nếu user đổi avatar, các bài viết cũ vẫn hiển thị avatar cũ cho tới khi có background job đồng bộ lại (chấp nhận được cho feed mạng xã hội — không giống dữ liệu tài chính cần chính xác tuyệt đối).

## Index

```js
db.follows.createIndex({ follower_id: 1, followee_id: 1 }, { unique: true }) // chống follow trùng
db.follows.createIndex({ followee_id: 1, created_at: -1 }) // "ai đang follow user X", mới nhất trước
db.posts.createIndex({ "author.user_id": 1, created_at: -1 })
```

## Xây feed — vì sao không query trực tiếp

Feed "bài viết của người mình follow" (join `follows` → `posts`, sort theo thời gian) là query tốn nhất hệ thống, y hệt vấn đề đã nêu ở bản RDBMS ([../../../rdbms/use-cases/04-social-network/README.md](../../../rdbms/use-cases/04-social-network/README.md#điểm-thiết-kế-đáng-chú-ý)). MongoDB không giải quyết vấn đề này tốt hơn RDBMS về bản chất — cách tiếp cận thực tế vẫn là:

1. **Fan-out on write**: khi user đăng bài, ghi `post_id` vào feed cache (Redis list/sorted set) của từng follower ngay lúc đăng — đọc feed cực nhanh (chỉ đọc Redis), nhưng tốn khi celebrity đăng bài (fan-out tới hàng triệu follower).
2. **Fan-out on read**: feed build động lúc user mở app (query `follows` rồi `$lookup`/query `posts`) — ghi rẻ, đọc đắt hơn. Thường dùng cho outlier (celebrity) kết hợp với fan-out on write cho user thường — đây là **cách Twitter/X công khai áp dụng** (hybrid fan-out) để tránh "thundering herd" khi celebrity đăng bài.

Xem thêm cách dùng Redis cho feed cache ở [../../../redis/use-cases](../../../redis/use-cases/README.md).

## Điểm thiết kế đáng chú ý

- Outlier pattern **không cần áp dụng ngay từ đầu cho mọi entity** — chỉ cần khi biết trước hệ thống có khả năng xuất hiện outlier vượt giới hạn thực tế (celebrity, viral content, bot follow hàng loạt). Với hệ thống nội bộ (vd: mạng xã hội công ty vài trăm nhân viên), embed thuần không cần Outlier pattern là đủ.
- `follower_count` là counter denormalize — cùng rủi ro lệch số như `comment_count` ở use-case trước, chấp nhận vì đây là số liệu hiển thị, không phải số liệu giao dịch.

## Ví dụ schema Mongoose (Node.js)

```typescript
import { Schema, model, Types } from 'mongoose';

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  avatarUrl: String,
  followerCount: { type: Number, default: 0 },
  followersPreview: { type: [Types.ObjectId], default: [] }, // giữ tối đa vài phần tử ở tầng application
  hasExtraFollowers: { type: Boolean, default: false },
});

const followSchema = new Schema({
  followerId: { type: Types.ObjectId, required: true },
  followeeId: { type: Types.ObjectId, required: true },
}, { timestamps: true });

followSchema.index({ followerId: 1, followeeId: 1 }, { unique: true });
followSchema.index({ followeeId: 1, createdAt: -1 });

const postSchema = new Schema({
  author: {
    userId: { type: Types.ObjectId, required: true },
    username: { type: String, required: true },
    avatarUrl: String,
  },
  content: { type: String, required: true },
}, { timestamps: true });

postSchema.index({ 'author.userId': 1, createdAt: -1 });

export const User = model('User', userSchema);
export const Follow = model('Follow', followSchema);
export const Post = model('Post', postSchema);
```
