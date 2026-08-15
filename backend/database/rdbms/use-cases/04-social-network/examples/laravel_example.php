<?php
// composer require staudenmeir/laravel-adjacency-list
// Package chuyên cho quan hệ tự tham chiếu (adjacency list) trong Eloquent — tự sinh
// WITH RECURSIVE phía dưới, tầng Controller/Model không cần viết SQL.

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Staudenmeir\LaravelAdjacencyList\Eloquent\HasRecursiveRelationships;

class User extends Model
{
    public $timestamps = false;

    protected $fillable = ['email'];
}

class Post extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'content'];

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }
}

class Like extends Model
{
    public $timestamps = false;
    public $incrementing = false; // khoá chính composite (user_id, post_id), không có id riêng

    protected $fillable = ['user_id', 'post_id'];
}

class Follow extends Model
{
    public $timestamps = false;
    public $incrementing = false; // khoá chính composite (follower_id, followee_id)

    protected $fillable = ['follower_id', 'followee_id'];
}

class Comment extends Model
{
    use HasRecursiveRelationships;

    public $timestamps = false;

    protected $fillable = ['post_id', 'user_id', 'parent_comment_id', 'content'];

    public function getParentKeyName(): string
    {
        return 'parent_comment_id'; // mặc định package dùng 'parent_id'
    }
}

namespace App\Http\Controllers;

use App\Models\Comment;

class CommentController extends Controller
{
    public function thread(int $postId)
    {
        // tree(): scope của package tự build recursive CTE, kèm cột depth/path
        // toTree(): gom kết quả phẳng thành cây children lồng nhau
        $comments = Comment::where('post_id', $postId)
            ->whereIsRoot()
            ->tree()
            ->get()
            ->toTree();

        return response()->json($comments);
    }
}

// routes/api.php
// Route::get('/posts/{postId}/comments/thread', [CommentController::class, 'thread']);
