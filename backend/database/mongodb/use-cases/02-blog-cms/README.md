# Blog/CMS — bài viết và comment lồng nhau

Bài viết có comment, comment có thể reply lẫn nhau nhiều cấp — cùng bài toán với [../../../rdbms/use-cases/04-social-network/README.md](../../../rdbms/use-cases/04-social-network/README.md) (RDBMS giải bằng self-referencing FK + recursive CTE). Ở MongoDB, câu hỏi trung tâm không phải "cây lưu thế nào" mà là **"embed hay reference"** — và câu trả lời phụ thuộc vào bài viết đó **thường có bao nhiêu comment**.

## Vấn đề với embed toàn bộ

Nhúng thẳng mọi comment vào document bài viết là cách đơn giản nhất — đọc 1 bài viết kèm toàn bộ comment chỉ cần **1 query duy nhất**, không cần join:

```json
{
  "_id": "post_101",
  "title": "Học MongoDB trong 10 phút",
  "content": "...",
  "comments": [
    {
      "comment_id": "c1",
      "user_id": "u_10",
      "content": "Bài viết hay quá!",
      "created_at": "2026-08-20T08:00:00Z",
      "replies": [
        { "comment_id": "c2", "user_id": "u_11", "content": "Đồng ý", "created_at": "2026-08-20T08:05:00Z" }
      ]
    }
  ]
}
```

Cách này **chỉ an toàn khi bài viết có ít comment** (blog cá nhân, tin tức nội bộ — vài chục đến vài trăm comment/bài). Với nền tảng nội dung lớn (bài viết có thể viral, hàng chục nghìn comment), mảng `comments` sẽ:

- Vi phạm giới hạn **16MB/document** khi đủ lớn.
- Làm chậm **mọi** thao tác trên document — kể cả chỉ sửa tiêu đề bài viết, MongoDB vẫn phải đọc/ghi lại toàn bộ document bao gồm mảng comment khổng lồ.
- Đây chính là **Massive Arrays Antipattern** được nhắc ở [../../README.md](../../README.md#5-lưu-ý-khi-thiết-kế-mongodb-khác-biệt-so-với-thói-quen-rdbms).

## Thiết kế đề xuất — tách collection, dùng Referencing + Bucket cho comment count lớn

```json
// posts
{
  "_id": "post_101",
  "title": "Học MongoDB trong 10 phút",
  "content": "...",
  "author_id": "u_1",
  "comment_count": 15234,
  "created_at": "2026-08-20T08:00:00Z"
}
```

```json
// comments — collection riêng, adjacency list giống RDBMS
{
  "_id": "c_98213",
  "post_id": "post_101",
  "parent_comment_id": null,
  "user_id": "u_10",
  "content": "Bài viết hay quá!",
  "depth": 0,
  "created_at": "2026-08-20T08:00:00Z"
}
{
  "_id": "c_98214",
  "post_id": "post_101",
  "parent_comment_id": "c_98213",
  "user_id": "u_11",
  "content": "Đồng ý",
  "depth": 1,
  "created_at": "2026-08-20T08:05:00Z"
}
```

## Quyết định thiết kế

- **`comments` là collection riêng (Referencing)**, không embed — vì số lượng comment/bài viết không có giới hạn tự nhiên và có thể viral bất kỳ lúc nào. Đây là dấu hiệu kinh điển để chọn reference thay vì embed (xem bảng ở [../../README.md](../../README.md#1-nguyên-tắc-cốt-lõi-embed-hay-reference)).
- **`post.comment_count` là counter denormalize**, cập nhật bằng `$inc` mỗi khi có comment mới — tránh phải `COUNT()` hàng chục nghìn document mỗi lần hiển thị trang bài viết.
- **`parent_comment_id` + `depth`** giữ nguyên adjacency list giống RDBMS — MongoDB không có `WITH RECURSIVE`, nên lấy toàn bộ thread phải: (1) query tất cả comment theo `post_id` rồi **dựng cây ở tầng ứng dụng** (đơn giản, phù hợp khi 1 bài viết vài nghìn comment, load hết vào memory được), hoặc (2) dùng aggregation `$graphLookup` (MongoDB có hỗ trợ truy vấn đệ quy trong pipeline, nhưng nặng hơn `$lookup` thường, không nên dùng trên hot path).
- **`depth` lưu sẵn** (thay vì tính lại) để tầng ứng dụng sort/indent comment mà không cần leo cây mỗi lần render.

## Index

```js
db.comments.createIndex({ post_id: 1, parent_comment_id: 1, created_at: 1 })
db.comments.createIndex({ post_id: 1, depth: 1 })
```

Query lấy toàn bộ comment của 1 bài viết (dựng cây ở tầng ứng dụng):

```js
db.comments.find({ post_id: "post_101" }).sort({ created_at: 1 })
```

Query lấy cây bằng `$graphLookup` (khi cần trả về đã lồng cây ngay từ DB):

```js
db.comments.aggregate([
  { $match: { post_id: "post_101", parent_comment_id: null } },
  {
    $graphLookup: {
      from: "comments",
      startWith: "$_id",
      connectFromField: "_id",
      connectToField: "parent_comment_id",
      as: "descendants",
      maxDepth: 10, // giới hạn độ sâu — tránh truy vấn vô hạn nếu thread quá sâu
    },
  },
])
```

## Điểm thiết kế đáng chú ý

- Khác với RDBMS (1 câu `WITH RECURSIVE` xử lý ở tầng DB), MongoDB thường đẩy việc **dựng cây sang tầng ứng dụng** vì đơn giản và dễ cache hơn — đánh đổi là phải tự viết logic dựng cây, nhưng tránh được `$graphLookup` (chi phí cao hơn nhiều so với `JOIN` có index của RDBMS).
- Nếu nghiệp vụ **chắc chắn** mỗi bài viết chỉ có tối đa vài chục comment (vd: CMS nội bộ công ty, không public) — embed thẳng vẫn là lựa chọn hợp lý và đơn giản hơn hẳn thiết kế này. Không nên áp dụng Referencing "cho chắc" khi dữ liệu thực tế luôn nhỏ — đó là over-engineering.
- Giới hạn `maxDepth` trong `$graphLookup` tương tự khuyến nghị giới hạn độ sâu ở tầng ứng dụng trong bản RDBMS — cả 2 kiến trúc đều cần chặn thread reply vô hạn.

## Ví dụ schema Mongoose (Node.js)

```typescript
import { Schema, model, Types } from 'mongoose';

const postSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  authorId: { type: Types.ObjectId, required: true, index: true },
  commentCount: { type: Number, default: 0 },
}, { timestamps: true });

const commentSchema = new Schema({
  postId: { type: Types.ObjectId, required: true, index: true },
  parentCommentId: { type: Types.ObjectId, default: null },
  userId: { type: Types.ObjectId, required: true },
  content: { type: String, required: true },
  depth: { type: Number, default: 0 },
}, { timestamps: true });

commentSchema.index({ postId: 1, parentCommentId: 1, createdAt: 1 });

export const Post = model('Post', postSchema);
export const Comment = model('Comment', commentSchema);

// tạo comment mới + tăng counter — 2 thao tác, không cần transaction
// vì comment_count là số liệu hiển thị (best-effort), không phải số liệu tài chính
export async function addComment(postId: string, data: Partial<typeof commentSchema>) {
  const comment = await Comment.create({ ...data, postId });
  await Post.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });
  return comment;
}
```
