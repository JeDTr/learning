// npm install ioredis

import { Injectable, Controller, Post, Get, Param, Body } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class PostStatsService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });

  async addView(postId: string) {
    const views = await this.redis.incr(`post:${postId}:views`);
    return { postId, views };
  }

  async like(postId: string, userId: string) {
    // SADD đảm bảo mỗi user chỉ like 1 lần (unique)
    const added = await this.redis.sadd(`post:${postId}:liked_by`, userId);
    if (added) {
      await this.redis.incr(`post:${postId}:likes`);
    }
    const likes = Number((await this.redis.get(`post:${postId}:likes`)) ?? 0);
    return { postId, likes };
  }

  async onlineUsersCount() {
    const count = await this.redis.scard('online_users');
    return { online: count };
  }
}

@Controller()
export class PostStatsController {
  constructor(private readonly postStatsService: PostStatsService) {}

  @Post('posts/:postId/view')
  addView(@Param('postId') postId: string) {
    return this.postStatsService.addView(postId);
  }

  @Post('posts/:postId/like')
  like(@Param('postId') postId: string, @Body('userId') userId: string) {
    return this.postStatsService.like(postId, userId);
  }

  @Get('users/online/count')
  onlineCount() {
    return this.postStatsService.onlineUsersCount();
  }
}
