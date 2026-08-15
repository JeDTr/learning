<?php
// composer require predis/predis

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class ChatController extends Controller
{
    public function publish(Request $request, string $room)
    {
        $payload = json_encode([
            'user' => $request->input('user'),
            'msg' => $request->input('msg'),
        ]);

        $subscribers = Redis::publish("chat:{$room}", $payload);

        return response()->json(['published' => true, 'subscribers_notified' => $subscribers]);
    }
}

// routes/api.php
// Route::post('/chat/{room}/publish', [ChatController::class, 'publish']);

// Subscriber riêng, chạy bằng: php artisan chat:subscribe room1
// app/Console/Commands/ChatSubscribe.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;

class ChatSubscribe extends Command
{
    protected $signature = 'chat:subscribe {room}';

    public function handle()
    {
        $room = $this->argument('room');
        $this->info("subscribed to chat:{$room}, waiting for messages...");

        Redis::subscribe(["chat:{$room}"], function ($message) use ($room) {
            $data = json_decode($message, true);
            $this->info("[{$room}] {$data['user']}: {$data['msg']}");
        });
    }
}
