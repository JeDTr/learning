<?php
// composer require predis/predis
// config/database.php đã có sẵn cấu hình 'redis' mặc định (dùng .env: REDIS_HOST, REDIS_PORT...)

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class LeaderboardController extends Controller
{
    protected string $key = 'leaderboard:game1';

    public function setScore(Request $request, string $playerId)
    {
        $score = $request->input('score');
        Redis::zadd($this->key, $score, $playerId);

        return response()->json(['player_id' => $playerId, 'score' => $score]);
    }

    public function incrementScore(Request $request, string $playerId)
    {
        $delta = $request->input('delta');
        $newScore = Redis::zincrby($this->key, $delta, $playerId);

        return response()->json(['player_id' => $playerId, 'score' => $newScore]);
    }

    public function topPlayers(int $n = 10)
    {
        // trả về mảng dạng [playerId => score, ...], đã sắp xếp giảm dần
        $results = Redis::zrevrange($this->key, 0, $n - 1, ['withscores' => true]);

        return response()->json($results);
    }

    public function playerRank(string $playerId)
    {
        $rank = Redis::zrevrank($this->key, $playerId);

        if (is_null($rank)) {
            return response()->json(['error' => 'player not found'], 404);
        }

        $score = Redis::zscore($this->key, $playerId);

        return response()->json([
            'player_id' => $playerId,
            'rank' => $rank + 1,
            'score' => $score,
        ]);
    }
}

// routes/api.php
// Route::post('/score/{playerId}', [LeaderboardController::class, 'setScore']);
// Route::post('/score/{playerId}/increment', [LeaderboardController::class, 'incrementScore']);
// Route::get('/leaderboard/top/{n}', [LeaderboardController::class, 'topPlayers']);
// Route::get('/leaderboard/rank/{playerId}', [LeaderboardController::class, 'playerRank']);
