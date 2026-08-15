<?php
// composer require predis/predis
// Laravel có Queue driver 'redis' sẵn (QUEUE_CONNECTION=redis trong .env), ví dụ dưới đây dùng Redis trực tiếp
// để minh hoạ cơ chế bên dưới (List + BRPOP), không qua Laravel Queue facade.

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class EmailController extends Controller
{
    protected string $queueKey = 'queue:emails';

    public function enqueue(Request $request)
    {
        $job = [
            'to' => $request->input('to'),
            'template' => $request->input('template', 'welcome'),
        ];

        Redis::lpush($this->queueKey, json_encode($job));

        return response()->json(['enqueued' => $job]);
    }
}

// routes/api.php
// Route::post('/emails/send', [EmailController::class, 'enqueue']);

// Worker riêng, chạy bằng: php artisan email:worker
// app/Console/Commands/EmailWorker.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;

class EmailWorker extends Command
{
    protected $signature = 'email:worker';
    protected string $queueKey = 'queue:emails';

    public function handle()
    {
        $this->info('worker started, waiting for jobs...');

        while (true) {
            $result = Redis::brpop($this->queueKey, 0);
            $job = json_decode($result[1], true);
            $this->info("sending email to {$job['to']} using template {$job['template']}");
            // xử lý gửi email thật ở đây
        }
    }
}
