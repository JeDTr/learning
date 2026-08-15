// npm install @nestjs/typeorm typeorm pg

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column()
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'transaction_id', type: 'bigint' })
  transactionId: number;

  @Column({ name: 'account_id', type: 'bigint' })
  accountId: number;

  @Column('numeric', { precision: 18, scale: 2 })
  amount: number; // dương = ghi Có, âm = ghi Nợ
}

import { Injectable, Controller, Post, Get, Param, Body, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class TransferService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(LedgerEntry) private readonly ledgerRepo: Repository<LedgerEntry>,
  ) {}

  async transfer(fromAccount: number, toAccount: number, amount: number, description: string) {
    if (amount <= 0) throw new BadRequestException('Số tiền phải > 0');

    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager.save(Transaction, { description });

      // 2 dòng ghi sổ trong cùng transaction: 1 Nợ, 1 Có — tổng luôn bằng 0
      await manager.save(LedgerEntry, [
        { transactionId: transaction.id, accountId: fromAccount, amount: -amount },
        { transactionId: transaction.id, accountId: toAccount, amount },
      ]);

      return { status: 'ok', transactionId: transaction.id };
    });
  }

  async getBalance(accountId: number) {
    const { sum } = await this.ledgerRepo
      .createQueryBuilder('entry')
      .select('COALESCE(SUM(entry.amount), 0)', 'sum')
      .where('entry.accountId = :accountId', { accountId })
      .getRawOne();

    return { accountId, balance: Number(sum) };
  }
}

@Controller()
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post('transfer')
  transfer(@Body() body: { fromAccount: number; toAccount: number; amount: number; description: string }) {
    return this.transferService.transfer(body.fromAccount, body.toAccount, body.amount, body.description);
  }

  @Get('accounts/:accountId/balance')
  getBalance(@Param('accountId') accountId: number) {
    return this.transferService.getBalance(accountId);
  }
}
