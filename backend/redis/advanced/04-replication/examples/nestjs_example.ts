// npm install ioredis

import { Injectable, Controller, Post, Get, Param } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ProductViewService {
  // Read/write splitting: ghi luôn qua master, đọc có thể qua replica để giảm tải cho master
  private readonly master = new Redis({ host: 'master.redis.internal', port: 6379 });
  private readonly replica = new Redis({ host: 'replica.redis.internal', port: 6379 });

  async incrementViews(productId: string) {
    // ghi -> luôn qua master
    const views = await this.master.incr(`product:${productId}:views`);
    return { productId, views };
  }

  async getViews(productId: string) {
    // đọc -> có thể qua replica, chấp nhận độ trễ replication vài ms
    const views = await this.replica.get(`product:${productId}:views`);
    return { productId, views: Number(views ?? 0) };
  }
}

@Controller('products')
export class ProductViewController {
  constructor(private readonly productViewService: ProductViewService) {}

  @Post(':productId/views')
  increment(@Param('productId') productId: string) {
    return this.productViewService.incrementViews(productId);
  }

  @Get(':productId/views')
  show(@Param('productId') productId: string) {
    return this.productViewService.getViews(productId);
  }
}
