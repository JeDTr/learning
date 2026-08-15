<?php
// composer require predis/predis
// predis chưa có wrapper tiện dụng cho Streams -> dùng executeRaw() để gọi lệnh XADD/XREADGROUP/XACK trực tiếp

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class EmailStreamController extends Controller
{
    protected string $stream = 'stream:emails';

    public function enqueue(Request $request)
    {
        $jobId = Redis::executeRaw([
            'XADD', $this->stream, '*',
            'to', $request->input('to'),
            'template', $request->input('template', 'welcome'),
        ]);

        return response()->json(['job_id' => $jobId]);
    }
}

// routes/api.php
// Route::post('/emails/send', [EmailStreamController::class, 'enqueue']);

// Worker riêng, chạy bằng: php artisan email:stream-worker
// app/Console/Commands/EmailStreamWorker.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;

class EmailStreamWorker extends Command
{
    protected $signature = 'email:stream-worker';
    protected string $stream = 'stream:emails';
    protected string $group = 'email_workers';
    protected string $consumer = 'worker-1';

    public function handle()
    {
        $this->ensureGroup();
        $this->info('worker started, waiting for jobs...');

        while (true) {
            $result = Redis::executeRaw([
                'XREADGROUP', 'GROUP', $this->group, $this->consumer,
                'COUNT', 1, 'BLOCK', 5000, 'STREAMS', $this->stream, '>',
            ]);

            if (! $result) {
                continue;
            }

            [, $messages] = $result[0];

            foreach ($messages as [$msgId, $fields]) {
                $data = [];
                for ($i = 0; $i < count($fields); $i += 2) {
                    $data[$fields[$i]] = $fields[$i + 1];
                }

                try {
                    $this->info("sending email to {$data['to']} using template {$data['template']}");
                    // xử lý gửi email thật ở đây
                    Redis::executeRaw(['XACK', $this->stream, $this->group, $msgId]); // báo đã xử lý xong
                } catch (\Throwable $e) {
                    $this->error("job {$msgId} failed: {$e->getMessage()}"); // không ack -> vẫn pending để retry
                }
            }
        }
    }

    protected function ensureGroup(): void
    {
        try {
            Redis::executeRaw(['XGROUP', 'CREATE', $this->stream, $this->group, '0', 'MKSTREAM']);
        } catch (\Throwable $e) {
            if (! str_contains($e->getMessage(), 'BUSYGROUP')) {
                throw $e;
            }
        }
    }
}

// Chạy định kỳ (cron riêng) để "cướp lại" job bị treo quá 60s (worker cũ crash giữa chừng):
// Redis::executeRaw(['XAUTOCLAIM', 'stream:emails', 'email_workers', 'worker-1', 60000, '0']);
