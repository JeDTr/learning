<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    public $timestamps = false;

    protected $fillable = ['description'];

    public function ledgerEntries()
    {
        return $this->hasMany(LedgerEntry::class);
    }
}

class LedgerEntry extends Model
{
    public $timestamps = false;

    protected $fillable = ['transaction_id', 'account_id', 'amount']; // amount: dương = Có, âm = Nợ

    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }
}

namespace App\Http\Controllers;

use App\Models\Transaction;
use App\Models\LedgerEntry;
use Illuminate\Support\Facades\DB;

class TransferController extends Controller
{
    public function store(int $fromAccount, int $toAccount, float $amount, string $description)
    {
        abort_if($amount <= 0, 400, 'Số tiền phải > 0');

        return DB::transaction(function () use ($fromAccount, $toAccount, $amount, $description) {
            $transaction = Transaction::create(['description' => $description]);

            // 2 dòng ghi sổ trong cùng transaction: 1 Nợ, 1 Có — tổng luôn bằng 0
            $transaction->ledgerEntries()->createMany([
                ['account_id' => $fromAccount, 'amount' => -$amount],
                ['account_id' => $toAccount, 'amount' => $amount],
            ]);

            return response()->json(['status' => 'ok', 'transaction_id' => $transaction->id]);
        });
    }

    public function balance(int $accountId)
    {
        $balance = LedgerEntry::where('account_id', $accountId)->sum('amount');

        return response()->json(['account_id' => $accountId, 'balance' => $balance]);
    }
}

// routes/api.php
// Route::post('/transfer', [TransferController::class, 'store']);
// Route::get('/accounts/{accountId}/balance', [TransferController::class, 'balance']);
