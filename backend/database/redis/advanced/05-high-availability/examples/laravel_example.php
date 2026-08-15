<?php
// composer require predis/predis
// Predis hỗ trợ Sentinel qua tham số 'replication' => 'sentinel' + 'service' (tên monitor trong sentinel.conf)

namespace App\Http\Controllers;

use Illuminate\Support\Facades\App;
use Predis\Client;

class OrderController extends Controller
{
    protected function client(): Client
    {
        // Client không kết nối thẳng vào 1 IP master cố định, mà hỏi Sentinel "master hiện tại là ai"
        return new Client([
            ['host' => 'sentinel1.internal', 'port' => 26379],
            ['host' => 'sentinel2.internal', 'port' => 26379],
            ['host' => 'sentinel3.internal', 'port' => 26379],
        ], [
            'replication' => 'sentinel',
            'service' => 'mymaster',
        ]);
    }

    public function create(string $orderId)
    {
        // Predis tự route lệnh ghi tới master hiện tại (kể cả sau khi failover)
        $this->client()->set("order:{$orderId}", 'created');

        return response()->json(['order_id' => $orderId, 'status' => 'created']);
    }

    public function show(string $orderId)
    {
        // Predis tự route lệnh đọc tới 1 replica đang được Sentinel giám sát
        $status = $this->client()->get("order:{$orderId}");

        return response()->json(['order_id' => $orderId, 'status' => $status]);
    }
}

// routes/api.php
// Route::post('/orders/{orderId}', [OrderController::class, 'create']);
// Route::get('/orders/{orderId}', [OrderController::class, 'show']);
