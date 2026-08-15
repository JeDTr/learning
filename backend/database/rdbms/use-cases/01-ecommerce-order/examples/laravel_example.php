<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class User extends Model
{
    public $timestamps = false;

    protected $fillable = ['email'];
}

class Product extends Model
{
    public $timestamps = false;

    protected $fillable = ['name', 'price', 'stock_qty'];
}

class Order extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'status'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }
}

class OrderItem extends Model
{
    public $timestamps = false;

    // unit_price: snapshot giá lúc mua, KHÔNG đọc lại products.price
    protected $fillable = ['order_id', 'product_id', 'quantity', 'unit_price'];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\OrderItem;
use Illuminate\Support\Facades\DB;

class OrderItemController extends Controller
{
    public function store(int $orderId, int $productId, int $quantity)
    {
        return DB::transaction(function () use ($orderId, $productId, $quantity) {
            // lockForUpdate(): khoá hàng product, tránh 2 request cùng đọc stock cũ
            $product = Product::where('id', $productId)->lockForUpdate()->firstOrFail();

            if ($product->stock_qty < $quantity) {
                abort(400, 'Không đủ tồn kho');
            }

            $product->decrement('stock_qty', $quantity);

            OrderItem::create([
                'order_id' => $orderId,
                'product_id' => $productId,
                'quantity' => $quantity,
                'unit_price' => $product->price, // snapshot giá tại thời điểm mua
            ]);

            return response()->json(['status' => 'ok', 'remaining_stock' => $product->stock_qty]);
        });
    }
}

// routes/api.php
// Route::post('/orders/{orderId}/items', [OrderItemController::class, 'store']);
