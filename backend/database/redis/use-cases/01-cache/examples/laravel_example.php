<?php
// composer require predis/predis
// config/database.php đã có sẵn cấu hình 'redis' mặc định (dùng .env: REDIS_HOST, REDIS_PORT...)

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Redis;

class ProductController extends Controller
{
    protected int $ttl = 300;

    protected function fetchProductFromDb(string $productId): array
    {
        // giả lập truy vấn DB chậm
        return ['id' => $productId, 'name' => "Product {$productId}", 'price' => 99.9];
    }

    public function show(string $productId)
    {
        $cacheKey = "product:{$productId}";
        $cached = Redis::get($cacheKey);

        if ($cached) {
            return response()->json(['source' => 'cache', 'data' => json_decode($cached, true)]);
        }

        $data = $this->fetchProductFromDb($productId);
        Redis::setex($cacheKey, $this->ttl, json_encode($data));

        return response()->json(['source' => 'db', 'data' => $data]);
    }

    public function invalidate(string $productId)
    {
        Redis::del("product:{$productId}");

        return response()->json(['invalidated' => $productId]);
    }
}

// routes/api.php
// Route::get('/product/{productId}', [ProductController::class, 'show']);
// Route::delete('/product/{productId}/cache', [ProductController::class, 'invalidate']);
