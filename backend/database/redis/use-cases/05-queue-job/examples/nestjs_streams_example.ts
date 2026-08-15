// npm install ioredis
// ioredis chưa có typing sẵn cho các lệnh Streams mới -> gọi qua redis.call(...)

import { Injectable, Controller, Post, Body, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

const STREAM_KEY = 'stream:emails';
const GROUP_NAME = 'email_workers';
const CONSUMER_NAME = 'worker-1';

async function ensureGroup(redis: Redis) {
  try {
    await redis.call('XGROUP', 'CREATE', STREAM_KEY, GROUP_NAME, '0', 'MKSTREAM');
  } catch (err) {
    if (!(err as Error).message.includes('BUSYGROUP')) throw err;
  }
}

@Injectable()
export class EmailStreamService implements OnModuleInit {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });

  async onModuleInit() {
    await ensureGroup(this.redis);
  }

  async enqueue(to: string, template: string) {
    const jobId = await this.redis.call('XADD', STREAM_KEY, '*', 'to', to, 'template', template);
    return { jobId };
  }
}

@Controller('emails')
export class EmailStreamController {
  constructor(private readonly emailStreamService: EmailStreamService) {}

  @Post('send')
  enqueue(@Body('to') to: string, @Body('template') template = 'welcome') {
    return this.emailStreamService.enqueue(to, template);
  }
}

// Worker riêng (chạy bằng: ts-node stream-worker.ts), tách khỏi HTTP process
@Injectable()
export class EmailStreamWorker implements OnModuleInit {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });

  async onModuleInit() {
    await ensureGroup(this.redis);
    this.run();
  }

  private async run() {
    console.log('worker started, waiting for jobs...');
    while (true) {
      // ">" nghĩa là "chỉ lấy job mới, chưa ai trong group xử lý"
      const resp = (await this.redis.call(
        'XREADGROUP',
        'GROUP',
        GROUP_NAME,
        CONSUMER_NAME,
        'COUNT',
        1,
        'BLOCK',
        5000,
        'STREAMS',
        STREAM_KEY,
        '>',
      )) as [string, [string, string[]][]][] | null;

      if (!resp) continue;

      const [, messages] = resp[0];
      for (const [msgId, fields] of messages) {
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) data[fields[i]] = fields[i + 1];

        try {
          console.log(`sending email to ${data.to} using template ${data.template}`);
          // xử lý gửi email thật ở đây
          await this.redis.call('XACK', STREAM_KEY, GROUP_NAME, msgId); // báo đã xử lý xong
        } catch (err) {
          console.error(`job ${msgId} failed:`, err); // không ack -> vẫn nằm trong pending list để retry
        }
      }
    }
  }
}

// Chạy định kỳ (process/cron riêng) để "cướp lại" job bị treo quá 60s (worker cũ crash giữa chừng):
// await redis.call('XAUTOCLAIM', STREAM_KEY, GROUP_NAME, CONSUMER_NAME, 60000, '0');
