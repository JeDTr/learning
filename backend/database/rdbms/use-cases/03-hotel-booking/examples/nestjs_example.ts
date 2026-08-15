// npm install @nestjs/typeorm typeorm pg
// TypeORM hỗ trợ sẵn kiểu cột 'daterange' cho driver postgres (cùng nhóm int4range, tsrange, tstzrange...)

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'room_id', type: 'bigint' })
  roomId: number;

  @Column({ name: 'guest_name' })
  guestName: string;

  @Column({ name: 'stay_range', type: 'daterange' })
  stayRange: string; // dạng '[2026-08-20,2026-08-23)'
}

import { Injectable, Controller, Post, Body, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';

@Injectable()
export class BookingService {
  constructor(@InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>) {}

  // Migration (xem DDL đầy đủ ở ../../README.md):
  // CREATE EXTENSION IF NOT EXISTS btree_gist;
  // ALTER TABLE bookings ADD CONSTRAINT no_overlap
  //   EXCLUDE USING gist (room_id WITH =, stay_range WITH &&);

  async create(roomId: number, guestName: string, checkIn: string, checkOut: string) {
    try {
      const booking = this.bookingRepo.create({
        roomId,
        guestName,
        stayRange: `[${checkIn},${checkOut})`,
      });
      await this.bookingRepo.save(booking);
      return { status: 'booked' };
    } catch (err) {
      if (err instanceof QueryFailedError) {
        // vi phạm EXCLUDE constraint: phòng đã được đặt trong khoảng ngày trùng
        throw new ConflictException('Phòng đã được đặt trong khoảng ngày này');
      }
      throw err;
    }
  }
}

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  create(@Body() body: { roomId: number; guestName: string; checkIn: string; checkOut: string }) {
    return this.bookingService.create(body.roomId, body.guestName, body.checkIn, body.checkOut);
  }
}
