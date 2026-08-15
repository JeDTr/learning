<?php
// composer require predis/predis

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Redis;

class PersistenceController extends Controller
{
    public function status()
    {
        // INFO trả về text thô, Predis đã tự parse thành mảng theo section khi gọi Redis::info()
        $info = Redis::info('persistence');

        return response()->json([
            'rdb_last_save_time' => $info['rdb_last_save_time'] ?? null,
            'rdb_bgsave_in_progress' => (bool) ($info['rdb_bgsave_in_progress'] ?? false),
            'rdb_last_bgsave_status' => $info['rdb_last_bgsave_status'] ?? null,
            'aof_enabled' => (bool) ($info['aof_enabled'] ?? false),
            'aof_rewrite_in_progress' => (bool) ($info['aof_rewrite_in_progress'] ?? false),
            'aof_last_bgrewrite_status' => $info['aof_last_bgrewrite_status'] ?? null,
        ]);
    }

    public function bgsave()
    {
        Redis::bgsave();

        return response()->json(['triggered' => 'BGSAVE']);
    }

    public function bgrewriteaof()
    {
        Redis::command('BGREWRITEAOF');

        return response()->json(['triggered' => 'BGREWRITEAOF']);
    }
}

// routes/api.php
// Route::get('/admin/persistence/status', [PersistenceController::class, 'status']);
// Route::post('/admin/persistence/bgsave', [PersistenceController::class, 'bgsave']);
// Route::post('/admin/persistence/bgrewriteaof', [PersistenceController::class, 'bgrewriteaof']);
