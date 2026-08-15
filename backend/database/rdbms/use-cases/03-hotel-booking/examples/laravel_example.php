<?php
// Eloquent không có kiểu dữ liệu daterange sẵn — bọc bằng 1 custom cast để tầng Controller
// vẫn thao tác qua Model bình thường, không tự viết SQL.

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

class DateRangeCast implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): string
    {
        return $value; // dạng chuỗi Postgres trả về, vd: '[2026-08-20,2026-08-23)'
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): string
    {
        // $value truyền vào dạng ['check_in' => '2026-08-20', 'check_out' => '2026-08-23']
        return "[{$value['check_in']},{$value['check_out']})";
    }
}

namespace App\Models;

use App\Casts\DateRangeCast;
use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    public $timestamps = false;

    protected $fillable = ['room_id', 'guest_name', 'stay_range'];

    protected $casts = [
        'stay_range' => DateRangeCast::class,
    ];
}

namespace App\Http\Controllers;

use App\Models\Booking;
use Illuminate\Database\QueryException;

class BookingController extends Controller
{
    // Migration (xem DDL đầy đủ ở ../../README.md):
    // DB::statement('CREATE EXTENSION IF NOT EXISTS btree_gist');
    // DB::statement('ALTER TABLE bookings ADD CONSTRAINT no_overlap
    //     EXCLUDE USING gist (room_id WITH =, stay_range WITH &&)');

    public function store(int $roomId, string $guestName, string $checkIn, string $checkOut)
    {
        try {
            Booking::create([
                'room_id' => $roomId,
                'guest_name' => $guestName,
                'stay_range' => ['check_in' => $checkIn, 'check_out' => $checkOut],
            ]);

            return response()->json(['status' => 'booked']);
        } catch (QueryException $e) {
            // vi phạm EXCLUDE constraint: phòng đã được đặt trong khoảng ngày trùng
            abort(409, 'Phòng đã được đặt trong khoảng ngày này');
        }
    }
}

// routes/api.php
// Route::post('/bookings', [BookingController::class, 'store']);
