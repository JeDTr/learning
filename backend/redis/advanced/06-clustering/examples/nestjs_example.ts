// npm install ioredis

import { Injectable, Controller, Post, Get, Param, Body } from '@nestjs/common';
import { Cluster } from 'ioredis';

@Injectable()
export class UserProfileService {
  // Client cluster-aware: tự biết bảng hash slot, tự redirect (MOVED/ASK) khi cần
  private readonly cluster = new Cluster([
    { host: '127.0.0.1', port: 7000 },
    { host: '127.0.0.1', port: 7001 },
    { host: '127.0.0.1', port: 7002 },
  ]);

  async setProfile(userId: string, name: string) {
    // dùng hash tag {userId} để đảm bảo profile + settings của cùng 1 user nằm cùng 1 slot
    await this.cluster.set(`user:{${userId}}:profile`, name);
    return { userId, name };
  }

  async setSettings(userId: string, theme: string) {
    await this.cluster.set(`user:{${userId}}:settings`, theme);
    return { userId, theme };
  }

  async getUser(userId: string) {
    // MGET nhiều key chỉ hợp lệ trong cluster nếu tất cả key cùng hash slot -> nhờ hash tag ở trên
    const [name, theme] = await this.cluster.mget(`user:{${userId}}:profile`, `user:{${userId}}:settings`);
    return { userId, name, theme };
  }
}

@Controller('users')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Post(':userId/profile')
  setProfile(@Param('userId') userId: string, @Body('name') name: string) {
    return this.userProfileService.setProfile(userId, name);
  }

  @Post(':userId/settings')
  setSettings(@Param('userId') userId: string, @Body('theme') theme: string) {
    return this.userProfileService.setSettings(userId, theme);
  }

  @Get(':userId')
  getUser(@Param('userId') userId: string) {
    return this.userProfileService.getUser(userId);
  }
}
