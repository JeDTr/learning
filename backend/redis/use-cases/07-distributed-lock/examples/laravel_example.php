<?php
// composer require predis/predis

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    protected int $lockTtl = 10; // giây

    // Lua script: chỉ xoá lock nếu value khớp (đúng chủ sở hữu)
    protected string $releaseLockScript = <<<'LUA'
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
    LUA;

    public function process(string $orderId)
    {
        $lockKey = "lock:order:{$orderId}";
        $token = (string) Str::uuid();

        $acquired = Redis::set($lockKey, $token, 'NX', 'EX', $this->lockTtl);

        if (! $acquired) {
            return response()->json(['error' => 'order is being processed by another worker'], 409);
        }

        try {
            // xử lý đơn hàng ở đây (idempotent, thời gian < lockTtl)
            return response()->json(['order_id' => $orderId, 'status' => 'processed']);
        } finally {
            Redis::eval($this->releaseLockScript, 1, $lockKey, $token);
        }
    }
}

// routes/api.php
// Route::post('/orders/{orderId}/process', [OrderController::class, 'process']);
