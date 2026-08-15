// npm install ioredis

import { Injectable, Controller, Post, Param, Body, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ChatPublisherService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });

  async publish(room: string, user: string, msg: string) {
    const payload = JSON.stringify({ user, msg });
    const subscribersNotified = await this.redis.publish(`chat:${room}`, payload);
    return { published: true, subscribersNotified };
  }
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatPublisherService: ChatPublisherService) {}

  @Post(':room/publish')
  publish(@Param('room') room: string, @Body('user') user: string, @Body('msg') msg: string) {
    return this.chatPublisherService.publish(room, user, msg);
  }
}

// Subscriber riêng (chạy bằng: ts-node subscriber.ts), thường dùng để đẩy tiếp qua WebSocket cho client
@Injectable()
export class ChatSubscriberService implements OnModuleInit {
  // ioredis yêu cầu 1 connection riêng cho subscribe, không dùng chung với connection publish
  private readonly subscriber = new Redis({ host: 'localhost', port: 6379 });

  async onModuleInit() {
    await this.subscriber.subscribe('chat:room1');
    this.subscriber.on('message', (channel, message) => {
      const data = JSON.parse(message);
      console.log(`[${channel}] ${data.user}: ${data.msg}`);
    });
  }
}
