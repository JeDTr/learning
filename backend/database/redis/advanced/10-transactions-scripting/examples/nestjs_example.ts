// npm install ioredis

import { Injectable, Controller, Post, Body, BadRequestException, ConflictException } from '@nestjs/common';
import Redis from 'ioredis';

// Lua script: atomic tuyệt đối, có logic điều kiện (transaction MULTI/EXEC thường không làm được)
const TRANSFER_SCRIPT = `
local from_balance = tonumber(redis.call('GET', KEYS[1]) or '0')
local amount = tonumber(ARGV[1])
if from_balance < amount then
    return -1
end
redis.call('DECRBY', KEYS[1], amount)
redis.call('INCRBY', KEYS[2], amount)
return 1
`;

@Injectable()
export class TransferService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });

  async transferViaLua(fromAccount: string, toAccount: string, amount: number) {
    // Cách 1: Lua script - atomic tuyệt đối, dừng ngay nếu số dư không đủ
    const result = await this.redis.eval(
      TRANSFER_SCRIPT,
      2,
      `account:${fromAccount}`,
      `account:${toAccount}`,
      amount,
    );

    if (result === -1) {
      throw new BadRequestException('insufficient balance');
    }
    return { from: fromAccount, to: toAccount, amount, status: 'transferred' };
  }

  async transferViaWatch(fromAccount: string, toAccount: string, amount: number) {
    // Cách 2: WATCH + MULTI/EXEC - optimistic lock, tự retry nếu bị đụng độ (giới hạn 5 lần thử)
    const fromKey = `account:${fromAccount}`;
    const toKey = `account:${toAccount}`;

    for (let attempt = 0; attempt < 5; attempt++) {
      await this.redis.watch(fromKey);
      const balance = Number((await this.redis.get(fromKey)) ?? 0);

      if (balance < amount) {
        await this.redis.unwatch();
        throw new BadRequestException('insufficient balance');
      }

      const result = await this.redis.multi().decrby(fromKey, amount).incrby(toKey, amount).exec();

      // ioredis trả về null nếu fromKey bị đổi bởi client khác kể từ WATCH -> transaction bị huỷ
      if (result !== null) {
        return { from: fromAccount, to: toAccount, amount, status: 'transferred' };
      }
    }

    throw new ConflictException('too many concurrent conflicts, please retry');
  }
}

@Controller('transfer')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post('lua')
  transferViaLua(
    @Body('fromAccount') fromAccount: string,
    @Body('toAccount') toAccount: string,
    @Body('amount') amount: number,
  ) {
    return this.transferService.transferViaLua(fromAccount, toAccount, amount);
  }

  @Post('watch')
  transferViaWatch(
    @Body('fromAccount') fromAccount: string,
    @Body('toAccount') toAccount: string,
    @Body('amount') amount: number,
  ) {
    return this.transferService.transferViaWatch(fromAccount, toAccount, amount);
  }
}
