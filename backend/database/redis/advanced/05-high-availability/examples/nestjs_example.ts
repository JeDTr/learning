// npm install ioredis

import { Injectable, Controller, Post, Get, Param } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class OrderService {
  // Client không kết nối thẳng vào 1 IP master cố định, mà hỏi Sentinel "master hiện tại là ai"
  private readonly redis = new Redis({
    sentinels: [
      { host: 'sentinel1.internal', port: 26379 },
      { host: 'sentinel2.internal', port: 26379 },
      { host: 'sentinel3.internal', port: 26379 },
    ],
    name: 'mymaster', // tên monitor khai báo trong sentinel.conf
    role: 'master',    // ioredis tự động reconnect tới master mới nếu failover xảy ra
  });

  async createOrder(orderId: string) {
    // ghi -> luôn qua master hiện tại
    await this.redis.set(`order:${orderId}`, 'created');
    return { orderId, status: 'created' };
  }

  async getOrder(orderId: string) {
    const status = await this.redis.get(`order:${orderId}`);
    return { orderId, status };
  }
}

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post(':orderId')
  create(@Param('orderId') orderId: string) {
    return this.orderService.createOrder(orderId);
  }

  @Get(':orderId')
  show(@Param('orderId') orderId: string) {
    return this.orderService.getOrder(orderId);
  }
}

// Muốn tách riêng client đọc qua replica: tạo thêm 1 instance Redis khác với { ...cùng sentinels, role: 'slave' }
