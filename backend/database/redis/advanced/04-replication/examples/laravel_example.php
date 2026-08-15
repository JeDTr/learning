<?php
// composer require predis/predis
// config/database.php -> khai báo 2 connection riêng biệt cho master/replica:
//
// 'redis' => [
//     'master' => [
//         'host' => env('REDIS_MASTER_HOST', 'master.redis.internal'),
//         'port' => env('REDIS_PORT', 6379),
//     ],
//     'replica' => [
//         'host' => env('REDIS_REPLICA_HOST', 'replica.redis.internal'),
//         'port' => env('REDIS_PORT', 6379),
//     ],
// ],

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Redis;

class ProductViewController extends Controller
{
    public function increment(string $productId)
    {
        // ghi -> luôn qua master
        $views = Redis::connection('master')->incr("product:{$productId}:views");

        return response()->json(['product_id' => $productId, 'views' => $views]);
    }

    public function show(string $productId)
    {
        // đọc -> có thể qua replica, chấp nhận độ trễ replication vài ms
        $views = Redis::connection('replica')->get("product:{$productId}:views");

        return response()->json(['product_id' => $productId, 'views' => (int) $views]);
    }
}

// routes/api.php
// Route::post('/products/{productId}/views', [ProductViewController::class, 'increment']);
// Route::get('/products/{productId}/views', [ProductViewController::class, 'show']);
