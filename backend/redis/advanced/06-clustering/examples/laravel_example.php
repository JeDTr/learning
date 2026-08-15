<?php
// composer require predis/predis
// config/database.php -> khai báo cluster gồm nhiều node, Predis tự tính hash slot và redirect:
//
// 'redis' => [
//     'clusters' => [
//         'default' => [
//             ['host' => '127.0.0.1', 'port' => 7000],
//             ['host' => '127.0.0.1', 'port' => 7001],
//             ['host' => '127.0.0.1', 'port' => 7002],
//         ],
//     ],
//     'options' => [
//         'cluster' => 'redis',
//     ],
// ],

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class UserProfileController extends Controller
{
    public function setProfile(Request $request, string $userId)
    {
        // dùng hash tag {userId} để đảm bảo profile + settings của cùng 1 user nằm cùng 1 slot
        Redis::connection('clusters')->set("user:{{$userId}}:profile", $request->input('name'));

        return response()->json(['user_id' => $userId, 'name' => $request->input('name')]);
    }

    public function setSettings(Request $request, string $userId)
    {
        Redis::connection('clusters')->set("user:{{$userId}}:settings", $request->input('theme'));

        return response()->json(['user_id' => $userId, 'theme' => $request->input('theme')]);
    }

    public function show(string $userId)
    {
        // MGET nhiều key chỉ hợp lệ trong cluster nếu tất cả key cùng hash slot -> nhờ hash tag ở trên
        [$profile, $settings] = Redis::connection('clusters')->mget([
            "user:{{$userId}}:profile",
            "user:{{$userId}}:settings",
        ]);

        return response()->json(['user_id' => $userId, 'name' => $profile, 'theme' => $settings]);
    }
}

// routes/api.php
// Route::post('/users/{userId}/profile', [UserProfileController::class, 'setProfile']);
// Route::post('/users/{userId}/settings', [UserProfileController::class, 'setSettings']);
// Route::get('/users/{userId}', [UserProfileController::class, 'show']);
