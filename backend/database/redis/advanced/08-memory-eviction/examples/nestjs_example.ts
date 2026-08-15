// npm install ioredis

import { Injectable, Controller, Get, Put, Param, Body } from '@nestjs/common';
import Redis from 'ioredis';

function parseInfo(raw: string): Record<string, string> {
  return Object.fromEntries(
    raw
      .split('\r\n')
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split(':')),
  );
}

@Injectable()
export class MemoryService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });

  async status() {
    const memory = parseInfo(await this.redis.info('memory'));
    const stats = parseInfo(await this.redis.info('stats'));

    const used = Number(memory.used_memory);
    const maxmemory = Number(memory.maxmemory ?? 0);

    return {
      usedMemoryHuman: memory.used_memory_human,
      maxmemoryHuman: memory.maxmemory_human,
      usagePct: maxmemory ? Math.round((used / maxmemory) * 1000) / 10 : null,
      evictionPolicy: memory.maxmemory_policy,
      evictedKeys: stats.evicted_keys,
    };
  }

  async keyUsage(key: string) {
    const bytes = await this.redis.call('MEMORY', 'USAGE', key);
    return { key, bytes };
  }

  async setPolicy(policy: string) {
    // ví dụ: allkeys-lru, volatile-lru, allkeys-lfu, volatile-ttl, noeviction...
    await this.redis.config('SET', 'maxmemory-policy', policy);
    return { 'maxmemory-policy': policy };
  }
}

@Controller('admin/memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get('status')
  status() {
    return this.memoryService.status();
  }

  @Get('key/:key')
  keyUsage(@Param('key') key: string) {
    return this.memoryService.keyUsage(key);
  }

  @Put('policy')
  setPolicy(@Body('policy') policy: string) {
    return this.memoryService.setPolicy(policy);
  }
}
