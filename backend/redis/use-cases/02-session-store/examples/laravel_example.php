<?php
// composer require predis/predis

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Str;

class SessionController extends Controller
{
    protected int $ttl = 1800; // 30 phút

    public function create(Request $request)
    {
        $sessionId = (string) Str::uuid();
        $payload = [
            'userId' => $request->input('user_id'),
            'role' => $request->input('role', 'user'),
        ];

        Redis::setex("session:{$sessionId}", $this->ttl, json_encode($payload));

        return response()->json(['session_id' => $sessionId]);
    }

    public function show(string $sessionId)
    {
        $data = Redis::get("session:{$sessionId}");

        if (! $data) {
            return response()->json(['error' => 'session not found or expired'], 404);
        }

        Redis::expire("session:{$sessionId}", $this->ttl); // gia hạn (sliding session)

        return response()->json(json_decode($data, true));
    }

    public function logout(string $sessionId)
    {
        Redis::del("session:{$sessionId}");

        return response()->json(['logged_out' => $sessionId]);
    }
}

// routes/api.php
// Route::post('/session', [SessionController::class, 'create']);
// Route::get('/session/{sessionId}', [SessionController::class, 'show']);
// Route::delete('/session/{sessionId}', [SessionController::class, 'logout']);
