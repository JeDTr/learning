// npm install ioredis

import { Injectable, Controller, Get, Post } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class PersistenceService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });

  async status() {
    const raw = await this.redis.info('persistence');
    const info = Object.fromEntries(
      raw
        .split('\r\n')
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split(':')),
    );

    return {
      rdbLastSaveTime: info.rdb_last_save_time,
      rdbBgsaveInProgress: info.rdb_bgsave_in_progress === '1',
      rdbLastBgsaveStatus: info.rdb_last_bgsave_status,
      aofEnabled: info.aof_enabled === '1',
      aofRewriteInProgress: info.aof_rewrite_in_progress === '1',
      aofLastBgrewriteStatus: info.aof_last_bgrewrite_status,
    };
  }

  async triggerBgsave() {
    await this.redis.bgsave();
    return { triggered: 'BGSAVE' };
  }

  async triggerBgrewriteaof() {
    await this.redis.call('BGREWRITEAOF');
    return { triggered: 'BGREWRITEAOF' };
  }
}

@Controller('admin/persistence')
export class PersistenceController {
  constructor(private readonly persistenceService: PersistenceService) {}

  @Get('status')
  status() {
    return this.persistenceService.status();
  }

  @Post('bgsave')
  bgsave() {
    return this.persistenceService.triggerBgsave();
  }

  @Post('bgrewriteaof')
  bgrewriteaof() {
    return this.persistenceService.triggerBgrewriteaof();
  }
}
