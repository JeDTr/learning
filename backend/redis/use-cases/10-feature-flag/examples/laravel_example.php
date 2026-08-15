<?php
// composer require predis/predis

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class FeatureFlagController extends Controller
{
    protected string $configKey = 'config:app';

    public function getFeature(string $flagName)
    {
        $value = Redis::get("feature:{$flagName}");

        return response()->json(['flag' => $flagName, 'enabled' => $value === 'true']);
    }

    public function setFeature(Request $request, string $flagName)
    {
        $enabled = $request->boolean('enabled');
        Redis::set("feature:{$flagName}", $enabled ? 'true' : 'false');

        return response()->json(['flag' => $flagName, 'enabled' => $enabled]);
    }

    public function getConfig()
    {
        return response()->json(Redis::hgetall($this->configKey));
    }

    public function setConfig(Request $request, string $key)
    {
        $value = $request->input('value');
        Redis::hset($this->configKey, $key, $value);

        return response()->json([$key => $value]);
    }
}

// routes/api.php
// Route::get('/features/{flagName}', [FeatureFlagController::class, 'getFeature']);
// Route::put('/features/{flagName}', [FeatureFlagController::class, 'setFeature']);
// Route::get('/config', [FeatureFlagController::class, 'getConfig']);
// Route::put('/config/{key}', [FeatureFlagController::class, 'setConfig']);
