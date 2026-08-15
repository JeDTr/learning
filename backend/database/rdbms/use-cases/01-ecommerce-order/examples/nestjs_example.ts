// npm install typeorm pg

import { Injectable, Controller, Post, Param, Body, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Product } from './product.entity';
import { OrderItem } from './order-item.entity';

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
