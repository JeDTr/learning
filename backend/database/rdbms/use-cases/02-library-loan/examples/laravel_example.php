<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Loan extends Model
{
    public $timestamps = false;

    protected $fillable = ['book_copy_id', 'member_id', 'due_at', 'borrowed_at', 'returned_at'];

    protected $casts = [
        'due_at' => 'datetime',
        'borrowed_at' => 'datetime',
        'returned_at' => 'datetime',
    ];
}

namespace App\Http\Controllers;

use App\Models\Loan;
use Illuminate\Database\QueryException;

class LoanController extends Controller
{
    // Migration tạo partial unique index (xem DDL đầy đủ ở ../../README.md):
    // DB::statement('CREATE UNIQUE INDEX idx_one_active_loan_per_copy ON loans(book_copy_id) WHERE returned_at IS NULL');

    public function store(int $bookCopyId, int $memberId, string $dueAt)
    {
        try {
            Loan::create([
                'book_copy_id' => $bookCopyId,
                'member_id' => $memberId,
                'due_at' => $dueAt,
                'borrowed_at' => now(),
            ]);

            return response()->json(['status' => 'borrowed']);
        } catch (QueryException $e) {
            // vi phạm idx_one_active_loan_per_copy: bản sao này đang được mượn
            abort(409, 'Bản sao sách này đang được người khác mượn');
        }
    }

    public function returnBook(int $loanId)
    {
        Loan::findOrFail($loanId)->update(['returned_at' => now()]);

        return response()->json(['status' => 'returned']);
    }
}

// routes/api.php
// Route::post('/loans', [LoanController::class, 'store']);
// Route::post('/loans/{loanId}/return', [LoanController::class, 'returnBook']);
