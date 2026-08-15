// npm install ioredis

import { Injectable, Controller, Post, Get, ConflictException } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class BackupService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });

  async triggerBackup() {
    // kích hoạt backup an toàn: từ chối nếu đã có BGSAVE khác đang chạy, tránh chồng chéo I/O
    const raw = await this.redis.info('persistence');
    const inProgress = raw.includes('rdb_bgsave_in_progress:1');

    if (inProgress) {
      throw new ConflictException('a BGSAVE is already in progress');
    }

    await this.redis.bgsave();
    return { triggered: true };
  }

  async lastBackup() {
    // trả về thời điểm snapshot RDB gần nhất, để dashboard/alert theo dõi backup có bị trễ không
    const timestamp = await this.redis.lastsave();
    const lastSave = new Date(timestamp * 1000);
    const ageSeconds = Math.floor((Date.now() - lastSave.getTime()) / 1000);

    return {
      lastSaveAt: lastSave.toISOString(),
      ageSeconds,
      stale: ageSeconds > 24 * 3600, // cảnh báo nếu backup gần nhất quá 24h
    };
  }
}

@Controller('admin/backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('trigger')
  trigger() {
    return this.backupService.triggerBackup();
  }

  @Get('last')
  last() {
    return this.backupService.lastBackup();
  }
}
