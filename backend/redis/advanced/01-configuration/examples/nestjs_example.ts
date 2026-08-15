// npm install ioredis

import { Injectable, Controller, Get, Put, Post, Param, Body } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisConfigService {
  // Kết nối có áp dụng các option cấu hình quan trọng (khớp advanced/01-configuration/README.md)
  private readonly redis = new Redis({
    host: 'localhost',
    port: 6379,
    password: 'your_strong_password', // khớp 'requirepass' trong redis.conf
    connectTimeout: 5000,               // ms, tránh app treo nếu Redis không phản hồi
    commandTimeout: 5000,
  });

  async getConfig(key: string) {
    // đọc 1 directive đang áp dụng lúc runtime, vd: maxmemory, maxmemory-policy
    const result = await this.redis.config('GET', key);
    return result;
  }

  async setConfig(key: string, value: string) {
    // đổi config lúc runtime; chưa persist xuống file, cần gọi thêm rewriteConfig()
    await this.redis.config('SET', key, value);
    return { [key]: value };
  }

  async rewriteConfig() {
    // ghi lại toàn bộ config runtime hiện tại xuống file redis.conf, giữ sau khi restart
    await this.redis.call('CONFIG', 'REWRITE');
    return { rewritten: true };
  }
}

@Controller('admin/config')
export class RedisConfigController {
  constructor(private readonly redisConfigService: RedisConfigService) {}

  @Get(':key')
  getConfig(@Param('key') key: string) {
    return this.redisConfigService.getConfig(key);
  }

  @Put(':key')
  setConfig(@Param('key') key: string, @Body('value') value: string) {
    return this.redisConfigService.setConfig(key, value);
  }

  @Post('rewrite')
  rewriteConfig() {
    return this.redisConfigService.rewriteConfig();
  }
}
