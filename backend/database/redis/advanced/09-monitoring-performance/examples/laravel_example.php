<?php
// composer require predis/predis

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class RedisMonitoringController extends Controller
{
    public function health()
    {
        // Health-check endpoint gọn cho load balancer/uptime monitor
        try {
            Redis::ping();

            return response()->json(['status' => 'ok']);
        } catch (\Throwable $e) {
            return response()->json(['status' => 'down'], 503);
        }
    }

    public function metrics()
    {
        // Chỉ số chi tiết hơn cho dashboard nội bộ (không public)
        $stats = Redis::info('stats');
        $memory = Redis::info('memory');
        $clients = Redis::info('clients');

        $hits = (int) ($stats['keyspace_hits'] ?? 0);
        $misses = (int) ($stats['keyspace_misses'] ?? 0);
        $total = $hits + $misses;

        return response()->json([
            'ops_per_sec' => $stats['instantaneous_ops_per_sec'] ?? null,
            'connected_clients' => $clients['connected_clients'] ?? null,
            'used_memory_human' => $memory['used_memory_human'] ?? null,
            'evicted_keys' => $stats['evicted_keys'] ?? null,
            'hit_rate_pct' => $total ? round($hits / $total * 100, 1) : null,
        ]);
    }

    public function slowlog(Request $request)
    {
        $count = (int) $request->query('count', 10);
        $entries = Redis::command('SLOWLOG', ['GET', $count]);

        $result = array_map(fn ($e) => [
            'id' => $e[0],
            'duration_us' => $e[2],
            'command' => implode(' ', $e[3]),
        ], $entries);

        return response()->json($result);
    }
}

// routes/api.php
// Route::get('/health/redis', [RedisMonitoringController::class, 'health']);
// Route::get('/admin/metrics/redis', [RedisMonitoringController::class, 'metrics']);
// Route::get('/admin/slowlog', [RedisMonitoringController::class, 'slowlog']);
