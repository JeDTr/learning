<?php
// composer require predis/predis

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class PostController extends Controller
{
    public function addView(string $postId)
    {
        $views = Redis::incr("post:{$postId}:views");

        return response()->json(['post_id' => $postId, 'views' => $views]);
    }

    public function like(Request $request, string $postId)
    {
        $userId = $request->input('user_id');

        // SADD đảm bảo mỗi user chỉ like 1 lần (unique)
        $added = Redis::sadd("post:{$postId}:liked_by", $userId);
        if ($added) {
            Redis::incr("post:{$postId}:likes");
        }

        $likes = (int) Redis::get("post:{$postId}:likes");

        return response()->json(['post_id' => $postId, 'likes' => $likes]);
    }

    public function onlineCount()
    {
        $count = Redis::scard('online_users');

        return response()->json(['online' => $count]);
    }
}

// routes/api.php
// Route::post('/posts/{postId}/view', [PostController::class, 'addView']);
// Route::post('/posts/{postId}/like', [PostController::class, 'like']);
// Route::get('/users/online/count', [PostController::class, 'onlineCount']);
