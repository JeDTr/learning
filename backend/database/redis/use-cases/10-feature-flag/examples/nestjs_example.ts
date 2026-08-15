// npm install ioredis

import { Injectable, Controller, Get, Put, Param, Body } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class FeatureFlagService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });
  private readonly configKey = 'config:app';

  async getFeature(flagName: string) {
    const value = await this.redis.get(`feature:${flagName}`);
    return { flag: flagName, enabled: value === 'true' };
  }

  async setFeature(flagName: string, enabled: boolean) {
    await this.redis.set(`feature:${flagName}`, enabled ? 'true' : 'false');
    return { flag: flagName, enabled };
  }

  async getConfig() {
    return this.redis.hgetall(this.configKey);
  }

  async setConfig(key: string, value: string) {
    await this.redis.hset(this.configKey, key, value);
    return { [key]: value };
  }
}

@Controller()
export class FeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Get('features/:flagName')
  getFeature(@Param('flagName') flagName: string) {
    return this.featureFlagService.getFeature(flagName);
  }

  @Put('features/:flagName')
  setFeature(@Param('flagName') flagName: string, @Body('enabled') enabled: boolean) {
    return this.featureFlagService.setFeature(flagName, enabled);
  }

  @Get('config')
  getConfig() {
    return this.featureFlagService.getConfig();
  }

  @Put('config/:key')
  setConfig(@Param('key') key: string, @Body('value') value: string) {
    return this.featureFlagService.setConfig(key, value);
  }
}
