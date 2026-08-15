<?php
// composer require predis/predis
// app/Http/Middleware/RedisRateLimit.php — đăng ký trong bootstrap/app.php hoặc Kernel.php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class RedisRateLimit
{
    protected int $limit = 100;   // số request tối đa
    protected int $window = 60;   // trong mỗi phút (giây)

    public function handle(Request $request, Closure $next)
    {
        $userId = $request->query('user_id', $request->ip());
        $windowKey = now()->format('Y-m-d\TH:i');
        $key = "ratelimit:user:{$userId}:{$windowKey}";

        $current = Redis::incr($key);
        if ($current === 1) {
            Redis::expire($key, $this->window);
        }

        if ($current > $this->limit) {
            return response()->json(['error' => 'rate limit exceeded'], 429);
        }

        return $next($request);
    }
}

// routes/api.php
// Route::middleware(\App\Http\Middleware\RedisRateLimit::class)->group(function () {
//     Route::get('/data', fn (Illuminate\Http\Request $r) => response()->json(['data' => 'ok', 'user_id' => $r->query('user_id')]));
// });
