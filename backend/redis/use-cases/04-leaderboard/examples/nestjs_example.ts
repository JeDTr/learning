// npm install ioredis

import { Injectable, Controller, Get, Post, Param, Body, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class LeaderboardService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });
  private readonly key = 'leaderboard:game1';

  async setScore(playerId: string, score: number) {
    await this.redis.zadd(this.key, score, playerId);
    return { playerId, score };
  }

  async incrementScore(playerId: string, delta: number) {
    const newScore = await this.redis.zincrby(this.key, delta, playerId);
    return { playerId, score: Number(newScore) };
  }

  async topPlayers(n = 10) {
    const raw = await this.redis.zrevrange(this.key, 0, n - 1, 'WITHSCORES');
    const result: { playerId: string; score: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      result.push({ playerId: raw[i], score: Number(raw[i + 1]) });
    }
    return result;
  }

  async playerRank(playerId: string) {
    const rank = await this.redis.zrevrank(this.key, playerId);
    if (rank === null) {
      throw new NotFoundException('player not found');
    }
    const score = await this.redis.zscore(this.key, playerId);
    return { playerId, rank: rank + 1, score: Number(score) };
  }
}

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Post(':playerId/score')
  setScore(@Param('playerId') playerId: string, @Body('score') score: number) {
    return this.leaderboardService.setScore(playerId, score);
  }

  @Post(':playerId/increment')
  incrementScore(@Param('playerId') playerId: string, @Body('delta') delta: number) {
    return this.leaderboardService.incrementScore(playerId, delta);
  }

  @Get('top/:n')
  topPlayers(@Param('n') n: string) {
    return this.leaderboardService.topPlayers(Number(n));
  }

  @Get('rank/:playerId')
  playerRank(@Param('playerId') playerId: string) {
    return this.leaderboardService.playerRank(playerId);
  }
}
