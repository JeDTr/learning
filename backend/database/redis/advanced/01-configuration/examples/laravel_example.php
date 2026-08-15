<?php
// composer require predis/predis
// config/database.php -> 'redis' -> 'default' nên khai báo đủ password/timeout (khớp advanced/01-configuration/README.md):
//
// 'redis' => [
//     'default' => [
//         'host' => env('REDIS_HOST', '127.0.0.1'),
//         'password' => env('REDIS_PASSWORD'),   // khớp 'requirepass' trong redis.conf
//         'port' => env('REDIS_PORT', 6379),
//         'timeout' => 5,                          // giây, tránh app treo nếu Redis không phản hồi
//     ],
// ],

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class RedisConfigController extends Controller
{
    public function get(string $key)
    {
        // đọc 1 directive đang áp dụng lúc runtime, vd: maxmemory, maxmemory-policy
        $result = Redis::config('GET', $key);

        return response()->json($result);
    }

    public function set(Request $request, string $key)
    {
        $value = $request->input('value');

        // đổi config lúc runtime; chưa persist xuống file, cần gọi thêm rewrite()
        Redis::config('SET', $key, $value);

        return response()->json([$key => $value]);
    }

    public function rewrite()
    {
        // ghi lại toàn bộ config runtime hiện tại xuống file redis.conf, giữ sau khi restart
        Redis::command('CONFIG', ['REWRITE']);

        return response()->json(['rewritten' => true]);
    }
}

// routes/api.php
// Route::get('/admin/config/{key}', [RedisConfigController::class, 'get']);
// Route::put('/admin/config/{key}', [RedisConfigController::class, 'set']);
// Route::post('/admin/config/rewrite', [RedisConfigController::class, 'rewrite']);
