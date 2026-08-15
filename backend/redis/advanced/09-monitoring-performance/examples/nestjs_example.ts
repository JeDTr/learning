// npm install ioredis

import { Injectable, Controller, Get, Query } from '@nestjs/common';
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
export class RedisMonitoringService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });

  async health() {
    // Health-check endpoint gọn cho load balancer/uptime monitor
    try {
      await this.redis.ping();
      return { status: 'ok' };
    } catch {
      return { status: 'down' };
    }
  }

  async metrics() {
    // Chỉ số chi tiết hơn cho dashboard nội bộ (không public)
    const stats = parseInfo(await this.redis.info('stats'));
    const memory = parseInfo(await this.redis.info('memory'));
    const clients = parseInfo(await this.redis.info('clients'));

    const hits = Number(stats.keyspace_hits ?? 0);
    const misses = Number(stats.keyspace_misses ?? 0);
    const total = hits + misses;

    return {
      opsPerSec: stats.instantaneous_ops_per_sec,
      connectedClients: clients.connected_clients,
      usedMemoryHuman: memory.used_memory_human,
      evictedKeys: stats.evicted_keys,
      hitRatePct: total ? Math.round((hits / total) * 1000) / 10 : null,
    };
  }

  async slowlog(count = 10) {
    const entries = (await this.redis.call('SLOWLOG', 'GET', count)) as [number, number, number, string[]][];
    return entries.map(([id, , durationUs, command]) => ({
      id,
      durationUs,
      command: command.join(' '),
    }));
  }
}

@Controller()
export class RedisMonitoringController {
  constructor(private readonly redisMonitoringService: RedisMonitoringService) {}

  @Get('health/redis')
  health() {
    return this.redisMonitoringService.health();
  }

  @Get('admin/metrics/redis')
  metrics() {
    return this.redisMonitoringService.metrics();
  }

  @Get('admin/slowlog')
  slowlog(@Query('count') count?: string) {
    return this.redisMonitoringService.slowlog(count ? Number(count) : 10);
  }
}
