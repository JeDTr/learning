// npm install ioredis

import { Injectable, Controller, Post, Body, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

interface EmailJob {
  to: string;
  template: string;
}

@Injectable()
export class EmailQueueService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });
  private readonly queueKey = 'queue:emails';

  async enqueue(job: EmailJob) {
    await this.redis.lpush(this.queueKey, JSON.stringify(job));
    return { enqueued: job };
  }
}

@Controller('emails')
export class EmailController {
  constructor(private readonly emailQueueService: EmailQueueService) {}

  @Post('send')
  enqueue(@Body('to') to: string, @Body('template') template = 'welcome') {
    return this.emailQueueService.enqueue({ to, template });
  }
}

// Worker riêng (chạy bằng: ts-node worker.ts), tách khỏi HTTP process
@Injectable()
export class EmailWorker implements OnModuleInit {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });
  private readonly queueKey = 'queue:emails';

  async onModuleInit() {
    this.run();
  }

  private async run() {
    console.log('worker started, waiting for jobs...');
    while (true) {
      const result = await this.redis.brpop(this.queueKey, 0);
      const job: EmailJob = JSON.parse(result[1]);
      console.log(`sending email to ${job.to} using template ${job.template}`);
      // xử lý gửi email thật ở đây
    }
  }
}
