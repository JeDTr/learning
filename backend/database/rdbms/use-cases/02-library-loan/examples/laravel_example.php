<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Author extends Model
{
    public $timestamps = false;

    protected $fillable = ['name'];

    public function books()
    {
        return $this->belongsToMany(Book::class, 'book_authors');
    }
}

class Book extends Model
{
    public $timestamps = false;

    protected $fillable = ['title', 'isbn'];

    public function authors()
    {
        return $this->belongsToMany(Author::class, 'book_authors');
    }

    public function copies()
    {
        return $this->hasMany(BookCopy::class);
    }
}

class BookCopy extends Model
{
    public $timestamps = false;

    protected $fillable = ['book_id', 'barcode'];

    public function book()
    {
        return $this->belongsTo(Book::class);
    }
}

class Member extends Model
{
    public $timestamps = false;

    protected $fillable = ['name'];
}

class Loan extends Model
{
    public $timestamps = false;

    protected $fillable = ['book_copy_id', 'member_id', 'due_at', 'borrowed_at', 'returned_at'];

    protected $casts = [
        'due_at' => 'datetime',
        'borrowed_at' => 'datetime',
        'returned_at' => 'datetime',
    ];

    public function bookCopy()
    {
        return $this->belongsTo(BookCopy::class);
    }

    public function member()
    {
        return $this->belongsTo(Member::class);
    }
}

namespace App\Http\Controllers;

use App\Models\Loan;
use Illuminate\Database\QueryException;

class LoanController extends Controller
{
    // Partial unique index không biểu diễn được qua schema builder của Eloquent —
    // phải tạo thủ công trong migration (xem DDL đầy đủ ở ../../README.md):
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
