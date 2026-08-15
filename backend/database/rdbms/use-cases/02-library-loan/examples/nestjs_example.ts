// npm install @nestjs/typeorm typeorm pg

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToMany, JoinTable,
} from 'typeorm';

@Entity('authors')
export class Author {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column()
  name: string;
}

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column()
  title: string;

  @Column({ unique: true, nullable: true })
  isbn: string;

  // Bảng trung gian book_authors do TypeORM tự quản lý qua @JoinTable
  @ManyToMany(() => Author)
  @JoinTable({
    name: 'book_authors',
    joinColumn: { name: 'book_id' },
    inverseJoinColumn: { name: 'author_id' },
  })
  authors: Author[];
}

@Entity('book_copies')
export class BookCopy {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'book_id', type: 'bigint' })
  bookId: number;

  @Column({ unique: true })
  barcode: string;
}

@Entity('members')
export class Member {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column()
  name: string;
}

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'book_copy_id', type: 'bigint' })
  bookCopyId: number;

  @Column({ name: 'member_id', type: 'bigint' })
  memberId: number;

  @CreateDateColumn({ name: 'borrowed_at' })
  borrowedAt: Date;

  @Column({ name: 'due_at', type: 'timestamptz' })
  dueAt: Date;

  @Column({ name: 'returned_at', type: 'timestamptz', nullable: true })
  returnedAt: Date | null; // NULL = đang được mượn
}

import { Injectable, Controller, Post, Param, Body, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';

@Injectable()
export class LoanService {
  constructor(@InjectRepository(Loan) private readonly loanRepo: Repository<Loan>) {}

  // Partial unique index không biểu diễn được qua @Column/@Index của TypeORM —
  // phải tạo thủ công trong migration (xem DDL đầy đủ ở ../../README.md):
  // CREATE UNIQUE INDEX idx_one_active_loan_per_copy ON loans(book_copy_id) WHERE returned_at IS NULL;

  async borrow(bookCopyId: number, memberId: number, dueAt: Date) {
    try {
      const loan = this.loanRepo.create({ bookCopyId, memberId, dueAt });
      await this.loanRepo.save(loan);
      return { status: 'borrowed' };
    } catch (err) {
      if (err instanceof QueryFailedError) {
        // vi phạm idx_one_active_loan_per_copy: bản sao này đang được mượn
        throw new ConflictException('Bản sao sách này đang được người khác mượn');
      }
      throw err;
    }
  }

  async returnBook(loanId: number) {
    await this.loanRepo.update(loanId, { returnedAt: new Date() });
    return { status: 'returned' };
  }
}

@Controller('loans')
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  @Post()
  borrow(@Body() body: { bookCopyId: number; memberId: number; dueAt: string }) {
    return this.loanService.borrow(body.bookCopyId, body.memberId, new Date(body.dueAt));
  }

  @Post(':loanId/return')
  returnBook(@Param('loanId') loanId: number) {
    return this.loanService.returnBook(loanId);
  }
}
