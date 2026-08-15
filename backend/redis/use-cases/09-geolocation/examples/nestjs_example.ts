// npm install ioredis

import { Injectable, Controller, Post, Get, Param, Body, Query } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ShipperLocationService {
  private readonly redis = new Redis({ host: 'localhost', port: 6379 });
  private readonly key = 'shippers';

  async updateLocation(shipperId: string, lon: number, lat: number) {
    await this.redis.geoadd(this.key, lon, lat, shipperId);
    return { shipperId, lon, lat };
  }

  async findNearby(lon: number, lat: number, radiusKm = 2) {
    // ioredis hỗ trợ GEOSEARCH qua "call" khi chưa có typing sẵn cho các option mới
    const raw = (await this.redis.call(
      'GEOSEARCH',
      this.key,
      'FROMLONLAT',
      lon,
      lat,
      'BYRADIUS',
      radiusKm,
      'km',
      'ASC',
      'WITHDIST',
    )) as [string, string][];

    return raw.map(([shipperId, distance]) => ({ shipperId, distanceKm: Number(distance) }));
  }
}

@Controller('shippers')
export class ShipperController {
  constructor(private readonly shipperLocationService: ShipperLocationService) {}

  @Post(':shipperId/location')
  updateLocation(@Param('shipperId') shipperId: string, @Body('lon') lon: number, @Body('lat') lat: number) {
    return this.shipperLocationService.updateLocation(shipperId, lon, lat);
  }

  @Get('nearby')
  findNearby(@Query('lon') lon: string, @Query('lat') lat: string, @Query('radius_km') radiusKm?: string) {
    return this.shipperLocationService.findNearby(Number(lon), Number(lat), radiusKm ? Number(radiusKm) : 2);
  }
}
