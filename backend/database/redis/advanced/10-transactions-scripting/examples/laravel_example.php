<?php
// composer require predis/predis

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class TransferController extends Controller
{
    // Lua script: atomic tuyệt đối, có logic điều kiện (transaction MULTI/EXEC thường không làm được)
    protected string $transferScript = <<<'LUA'
        local from_balance = tonumber(redis.call('GET', KEYS[1]) or '0')
        local amount = tonumber(ARGV[1])
        if from_balance < amount then
            return -1
        end
        redis.call('DECRBY', KEYS[1], amount)
        redis.call('INCRBY', KEYS[2], amount)
        return 1
    LUA;

    public function transferViaLua(Request $request)
    {
        // Cách 1: Lua script - atomic tuyệt đối, dừng ngay nếu số dư không đủ
        $from = $request->input('from_account');
        $to = $request->input('to_account');
        $amount = $request->input('amount');

        $result = Redis::eval($this->transferScript, 2, "account:{$from}", "account:{$to}", $amount);

        if ($result === -1) {
            return response()->json(['error' => 'insufficient balance'], 400);
        }

        return response()->json(['from' => $from, 'to' => $to, 'amount' => $amount, 'status' => 'transferred']);
    }

    public function transferViaWatch(Request $request)
    {
        // Cách 2: WATCH + MULTI/EXEC - optimistic lock, tự retry nếu bị đụng độ (giới hạn 5 lần thử)
        $from = $request->input('from_account');
        $to = $request->input('to_account');
        $amount = (int) $request->input('amount');
        $fromKey = "account:{$from}";
        $toKey = "account:{$to}";

        for ($attempt = 0; $attempt < 5; $attempt++) {
            Redis::watch($fromKey);
            $balance = (int) Redis::get($fromKey);

            if ($balance < $amount) {
                Redis::unwatch();

                return response()->json(['error' => 'insufficient balance'], 400);
            }

            $result = Redis::transaction(function ($tx) use ($fromKey, $toKey, $amount) {
                $tx->decrby($fromKey, $amount);
                $tx->incrby($toKey, $amount);
            });

            // Predis trả về null/false nếu $fromKey bị đổi bởi client khác kể từ WATCH -> transaction bị huỷ
            if ($result) {
                return response()->json(['from' => $from, 'to' => $to, 'amount' => $amount, 'status' => 'transferred']);
            }
        }

        return response()->json(['error' => 'too many concurrent conflicts, please retry'], 409);
    }
}

// routes/api.php
// Route::post('/transfer/lua', [TransferController::class, 'transferViaLua']);
// Route::post('/transfer/watch', [TransferController::class, 'transferViaWatch']);
