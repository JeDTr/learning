// npm install ioredis uuid

import { Injectable, Controller, Post, Param, ConflictException } from '@nestjs/common';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// Lua script: chỉ xoá lock nếu value khớp (đúng chủ sở hữu), tránh xoá nhầm lock của process khác
const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

@Injectable()
export class OrderService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });
  private readonly lockTtlSeconds = 10;

  async processOrder(orderId: string) {
    const lockKey = `lock:order:${orderId}`;
    const token = uuidv4();

    const acquired = await this.redis.set(lockKey, token, 'EX', this.lockTtlSeconds, 'NX');
    if (!acquired) {
      throw new ConflictException('order is being processed by another worker');
    }

    try {
      // xử lý đơn hàng ở đây (idempotent, thời gian < lockTtlSeconds)
      return { orderId, status: 'processed' };
    } finally {
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, token);
    }
  }
}

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post(':orderId/process')
  processOrder(@Param('orderId') orderId: string) {
    return this.orderService.processOrder(orderId);
  }
}
