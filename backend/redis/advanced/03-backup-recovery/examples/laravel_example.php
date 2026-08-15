<?php
// composer require predis/predis

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Support\Facades\Redis;

class BackupController extends Controller
{
    public function trigger()
    {
        // kích hoạt backup an toàn: từ chối nếu đã có BGSAVE khác đang chạy, tránh chồng chéo I/O
        $info = Redis::info('persistence');

        if (! empty($info['rdb_bgsave_in_progress'])) {
            return response()->json(['error' => 'a BGSAVE is already in progress'], 409);
        }

        Redis::bgsave();

        return response()->json(['triggered' => true]);
    }

    public function last()
    {
        // trả về thời điểm snapshot RDB gần nhất, để dashboard/alert theo dõi backup có bị trễ không
        $timestamp = Redis::lastsave();
        $lastSave = Carbon::createFromTimestampUTC($timestamp);
        $ageSeconds = now()->diffInSeconds($lastSave);

        return response()->json([
            'last_save_at' => $lastSave->toIso8601String(),
            'age_seconds' => $ageSeconds,
            'stale' => $ageSeconds > 24 * 3600, // cảnh báo nếu backup gần nhất quá 24h
        ]);
    }
}

// routes/api.php
// Route::post('/admin/backup/trigger', [BackupController::class, 'trigger']);
// Route::get('/admin/backup/last', [BackupController::class, 'last']);
