// npm install ioredis

import { Injectable, Controller, Get, Param } from '@nestjs/common';
import Redis from 'ioredis';
import { readFileSync } from 'fs';

@Injectable()
export class ProductService {
  // Kết nối bằng ACL user riêng (không dùng chung password cho mọi service) + TLS
  private readonly redis = new Redis({
    host: 'redis.internal',
    port: 6380,
    username: 'app_readonly', // user tạo bằng ACL SETUSER, chỉ đọc được "product:*"
    password: 'app_readonly_password',
    tls: {
      ca: readFileSync('/etc/redis/ca.crt'),
    },
  });

  async getProduct(productId: string) {
    // user app_readonly chỉ có quyền GET/MGET trên prefix "product:*" (xem advanced/07-security/README.md)
    const data = await this.redis.get(`product:${productId}`);
    return { productId, data };
  }
}

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get(':productId')
  getProduct(@Param('productId') productId: string) {
    return this.productService.getProduct(productId);
  }
}
