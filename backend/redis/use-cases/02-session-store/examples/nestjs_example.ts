// npm install ioredis uuid

import { Injectable, Controller, Get, Post, Delete, Param, Body, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SessionService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });
  private readonly ttlSeconds = 1800; // 30 phút

  async createSession(userId: number, role = 'user') {
    const sessionId = uuidv4();
    const payload = { userId, role };
    await this.redis.set(`session:${sessionId}`, JSON.stringify(payload), 'EX', this.ttlSeconds);
    return { sessionId };
  }

  async getSession(sessionId: string) {
    const data = await this.redis.get(`session:${sessionId}`);
    if (!data) {
      throw new NotFoundException('session not found or expired');
    }
    await this.redis.expire(`session:${sessionId}`, this.ttlSeconds); // gia hạn (sliding session)
    return JSON.parse(data);
  }

  async logout(sessionId: string) {
    await this.redis.del(`session:${sessionId}`);
    return { loggedOut: sessionId };
  }
}

@Controller('session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  create(@Body('userId') userId: number, @Body('role') role: string) {
    return this.sessionService.createSession(userId, role);
  }

  @Get(':sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.sessionService.getSession(sessionId);
  }

  @Delete(':sessionId')
  logout(@Param('sessionId') sessionId: string) {
    return this.sessionService.logout(sessionId);
  }
}
