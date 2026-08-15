<?php
// composer require predis/predis
// config/database.php -> connection riêng dùng ACL user + TLS:
//
// 'redis' => [
//     'readonly' => [
//         'scheme' => 'tls',
//         'host' => env('REDIS_HOST', 'redis.internal'),
//         'port' => env('REDIS_PORT', 6380),
//         'username' => 'app_readonly',       // user tạo bằng ACL SETUSER, chỉ đọc được "product:*"
//         'password' => env('REDIS_READONLY_PASSWORD'),
//         'ssl' => ['cafile' => '/etc/redis/ca.crt'],
//     ],
// ],

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Redis;

class ProductController extends Controller
{
    public function show(string $productId)
    {
        // user app_readonly chỉ có quyền GET/MGET trên prefix "product:*" (xem advanced/07-security/README.md)
        $data = Redis::connection('readonly')->get("product:{$productId}");

        return response()->json(['product_id' => $productId, 'data' => $data]);
    }
}

// routes/api.php
// Route::get('/products/{productId}', [ProductController::class, 'show']);
