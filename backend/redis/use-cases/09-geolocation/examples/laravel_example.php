<?php
// composer require predis/predis

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class ShipperController extends Controller
{
    protected string $key = 'shippers';

    public function updateLocation(Request $request, string $shipperId)
    {
        $lon = $request->input('lon');
        $lat = $request->input('lat');

        Redis::geoadd($this->key, $lon, $lat, $shipperId);

        return response()->json(['shipper_id' => $shipperId, 'lon' => $lon, 'lat' => $lat]);
    }

    public function nearby(Request $request)
    {
        $lon = $request->query('lon');
        $lat = $request->query('lat');
        $radiusKm = $request->query('radius_km', 2);

        // predis dùng lệnh GEOSEARCH qua command generic executeRaw/raw command
        $results = Redis::executeRaw([
            'GEOSEARCH', $this->key,
            'FROMLONLAT', $lon, $lat,
            'BYRADIUS', $radiusKm, 'km',
            'ASC', 'WITHDIST',
        ]);

        $shippers = array_map(fn ($r) => ['shipper_id' => $r[0], 'distance_km' => (float) $r[1]], $results);

        return response()->json($shippers);
    }
}

// routes/api.php
// Route::post('/shippers/{shipperId}/location', [ShipperController::class, 'updateLocation']);
// Route::get('/shippers/nearby', [ShipperController::class, 'nearby']);
