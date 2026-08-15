// npm install @nestjs/typeorm typeorm pg

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ unique: true })
  email: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column()
  name: string;

  @Column('numeric', { precision: 12, scale: 2 })
  price: number;

  @Column({ name: 'stock_qty' })
  stockQty: number;
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ default: 'pending' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'order_id', type: 'bigint' })
  orderId: number;

  @Column({ name: 'product_id', type: 'bigint' })
  productId: number;

  @Column()
  quantity: number;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2 })
  unitPrice: number; // snapshot giá lúc mua, KHÔNG đọc lại product.price
}

import { Injectable, Controller, Post, Param, Body, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class OrderItemService {
  constructor(private readonly dataSource: DataSource) {}

  async addItem(orderId: number, productId: number, quantity: number) {
    return this.dataSource.transaction(async (manager) => {
      // pessimistic_write: khoá hàng product, tránh 2 request cùng đọc stock cũ
      const product = await manager.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product || product.stockQty < quantity) {
        throw new BadRequestException('Không đủ tồn kho');
      }

      product.stockQty -= quantity;
      await manager.save(product);

      await manager.save(OrderItem, {
        orderId,
        productId,
        quantity,
        unitPrice: product.price, // snapshot giá tại thời điểm mua
      });

      return { status: 'ok', remainingStock: product.stockQty };
    });
  }
}

@Controller('orders')
export class OrderItemController {
  constructor(private readonly orderItemService: OrderItemService) {}

  @Post(':orderId/items')
  addItem(@Param('orderId') orderId: number, @Body() body: { productId: number; quantity: number }) {
    return this.orderItemService.addItem(orderId, body.productId, body.quantity);
  }
}
