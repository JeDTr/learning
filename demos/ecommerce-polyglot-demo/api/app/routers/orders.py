from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_session
from app.db.redis import redis_client
from app.models.order import Order, OrderItem, Payment
from app.models.schemas import CheckoutIn, OrderOut
from app.models.user import CartItem as CartItemRow
from app.payment_gateway import process_payment
from app.routers.cart import (
    _build_guest_cart,
    _build_user_cart,
    _get_or_create_user_cart_row,
    _guest_redis_key,
    _invalidate_user_cache,
)

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.post("", response_model=OrderOut)
async def checkout(
    payload: CheckoutIn,
    user_id: str | None = Header(default=None, alias="X-User-Id"),
    cart_id: str | None = Header(default=None, alias="X-Cart-Id"),
    session: AsyncSession = Depends(get_session),
):
    if not user_id and not cart_id:
        raise HTTPException(status_code=400, detail="Thiếu X-User-Id hoặc X-Cart-Id")

    lock_key = f"checkout_lock:{user_id or cart_id}"
    # SET NX: chi 1 request duoc xu ly checkout tren cung 1 gio hang tai 1 thoi diem,
    # tranh double-submit tao 2 don khi user bam nut "Dat hang" nhieu lan lien tuc.
    acquired = await redis_client.set(lock_key, "1", nx=True, ex=15)
    if not acquired:
        raise HTTPException(status_code=409, detail="Đơn hàng đang được xử lý, vui lòng đợi")

    try:
        if user_id:
            # doc thang tu Postgres (bo qua cache) de chac chan checkout dung so luong moi nhat
            cart = await _build_user_cart(session, user_id, use_cache=False)
        else:
            cart = await _build_guest_cart(cart_id)

        if not cart.items:
            raise HTTPException(status_code=400, detail="Giỏ hàng đang trống")

        order = Order(
            customer_name=payload.customer_name,
            customer_email=payload.customer_email,
            shipping_address=payload.shipping_address,
            status="pending",
            total_amount=cart.total,
        )
        order.items = [
            OrderItem(
                product_id=item.product_id,
                product_name=item.name,
                unit_price=item.price,
                quantity=item.quantity,
            )
            for item in cart.items
        ]
        session.add(order)
        await session.flush()  # can order.id truoc khi tao payment

        status, last4 = process_payment(payload.payment)
        order.payment = Payment(
            order_id=order.id,
            amount=cart.total,
            method="card",
            status=status,
            card_last4=last4,
        )
        order.status = "paid" if status == "success" else "failed"

        await session.commit()
        await session.refresh(order, attribute_names=["items", "payment"])

        if status == "success":
            if user_id:
                cart_row = await _get_or_create_user_cart_row(session, user_id)
                await session.execute(delete(CartItemRow).where(CartItemRow.cart_id == cart_row.id))
                await session.commit()
                await _invalidate_user_cache(user_id)
            else:
                await redis_client.delete(_guest_redis_key(cart_id))

        return order
    finally:
        await redis_client.delete(lock_key)


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    return order
