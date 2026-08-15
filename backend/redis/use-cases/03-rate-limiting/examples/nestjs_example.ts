// npm install ioredis

import { Injectable, NestMiddleware, HttpException, HttpStatus, Controller, Get, Query } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });
  private readonly limit = 100; // số request tối đa
  private readonly windowSeconds = 60; // trong mỗi phút

  async use(req: Request, res: Response, next: NextFunction) {
    const userId = (req.query.user_id as string) ?? req.ip;
    const window = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    const key = `ratelimit:user:${userId}:${window}`;

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, this.windowSeconds);
    }

    if (current > this.limit) {
      throw new HttpException('rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    next();
  }
}

@Controller('api')
export class DataController {
  @Get('data')
  getData(@Query('user_id') userId: string) {
    return { data: 'ok', userId };
  }
}

// Đăng ký middleware trong module:
// export class AppModule implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer.apply(RateLimitMiddleware).forRoutes(DataController);
//   }
// }
