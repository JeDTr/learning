<?php
// composer require predis/predis

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class MemoryController extends Controller
{
    public function status()
    {
        $memory = Redis::info('memory');
        $stats = Redis::info('stats');

        $used = (int) $memory['used_memory'];
        $maxmemory = (int) ($memory['maxmemory'] ?? 0);

        return response()->json([
            'used_memory_human' => $memory['used_memory_human'] ?? null,
            'maxmemory_human' => $memory['maxmemory_human'] ?? null,
            'usage_pct' => $maxmemory ? round($used / $maxmemory * 100, 1) : null,
            'eviction_policy' => $memory['maxmemory_policy'] ?? null,
            'evicted_keys' => $stats['evicted_keys'] ?? null,
        ]);
    }

    public function keyUsage(string $key)
    {
        $usage = Redis::command('MEMORY', ['USAGE', $key]);

        return response()->json(['key' => $key, 'bytes' => $usage]);
    }

    public function setPolicy(Request $request)
    {
        // ví dụ: allkeys-lru, volatile-lru, allkeys-lfu, volatile-ttl, noeviction...
        $policy = $request->input('policy');
        Redis::config('SET', 'maxmemory-policy', $policy);

        return response()->json(['maxmemory-policy' => $policy]);
    }
}

// routes/api.php
// Route::get('/admin/memory/status', [MemoryController::class, 'status']);
// Route::get('/admin/memory/key/{key}', [MemoryController::class, 'keyUsage']);
// Route::put('/admin/memory/policy', [MemoryController::class, 'setPolicy']);
