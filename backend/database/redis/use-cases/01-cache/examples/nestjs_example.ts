// npm install ioredis

import { Injectable, Controller, Get, Delete, Param } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ProductService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });
  private readonly ttlSeconds = 300;

  private async fetchProductFromDb(productId: string) {
    // giả lập truy vấn DB chậm
    return { id: productId, name: `Product ${productId}`, price: 99.9 };
  }

  async getProduct(productId: string) {
    const cacheKey = `product:${productId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return { source: 'cache', data: JSON.parse(cached) };
    }

    const data = await this.fetchProductFromDb(productId);
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', this.ttlSeconds);
    return { source: 'db', data };
  }

  async invalidateCache(productId: string) {
    await this.redis.del(`product:${productId}`);
    return { invalidated: productId };
  }
}

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get(':productId')
  getProduct(@Param('productId') productId: string) {
    return this.productService.getProduct(productId);
  }

  @Delete(':productId/cache')
  invalidateCache(@Param('productId') productId: string) {
    return this.productService.invalidateCache(productId);
  }
}
