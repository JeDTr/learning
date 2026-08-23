import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.mongodb import products_collection
from app.db.postgres import get_session
from app.db.redis import redis_client
from app.models.schemas import Cart, CartItemIn, CartItemOut, MergeCartIn
from app.models.user import Cart as CartRow
from app.models.user import CartItem as CartItemRow

router = APIRouter(prefix="/api/cart", tags=["cart"])

USER_CART_CACHE_TTL = 300  # giay - day chi la cache, Postgres moi la nguon su that


def _guest_redis_key(cart_id: str) -> str:
    return f"cart:{cart_id}"


def _user_cache_key(user_id: str) -> str:
    return f"usercart:{user_id}"


async def _enrich(cart_id: str, raw_items: dict[str, int]) -> Cart:
    """raw_items: product_id -> so luong. Dung chung cho ca guest cart va user cart,
    vi ca 2 deu can lay gia/ten/anh moi nhat tu Mongo (khong luu snapshot trong cart)."""
    if not raw_items:
        return Cart(cart_id=cart_id, items=[], total=0)

    cursor = products_collection.find({"_id": {"$in": list(raw_items.keys())}})
    products_by_id = {doc["_id"]: doc async for doc in cursor}

    items: list[CartItemOut] = []
    for product_id, qty in raw_items.items():
        product = products_by_id.get(product_id)
        if product is None:
            continue  # san pham da bi xoa khoi Mongo sau khi cho vao gio hang
        items.append(
            CartItemOut(
                product_id=product_id,
                name=product["name"],
                price=product["price"],
                image=product["image"],
                quantity=qty,
                subtotal=round(product["price"] * qty, 2),
            )
        )
    total = round(sum(item.subtotal for item in items), 2)
    return Cart(cart_id=cart_id, items=items, total=total)


# ---------- Gio hang an danh (guest): Redis la nguon su that, TTL 7 ngay ----------


async def _build_guest_cart(cart_id: str) -> Cart:
    raw = await redis_client.hgetall(_guest_redis_key(cart_id))
    raw_items = {pid: int(qty) for pid, qty in raw.items()}
    cart = await _enrich(cart_id, raw_items)

    stale_ids = set(raw_items) - {item.product_id for item in cart.items}
    if stale_ids:
        await redis_client.hdel(_guest_redis_key(cart_id), *stale_ids)
    return cart


# ---------- Gio hang cua user da dang nhap: Postgres la nguon su that, ----------
# ---------- Redis chi la cache doc (TTL ngan, invalidate moi lan ghi)  ----------


async def _get_or_create_user_cart_row(session: AsyncSession, user_id: str) -> CartRow:
    result = await session.execute(select(CartRow).where(CartRow.user_id == user_id))
    cart_row = result.scalar_one_or_none()
    if cart_row is None:
        # items=[] tuong minh: neu khong SQLAlchemy se coi quan he "items" la
        # chua duoc nap va co lazy-load lai tu DB o lan truy cap dau tien - nhung
        # lazy-load ngoai luc dang await select() se lam AsyncSession bao loi
        # MissingGreenlet. Object moi tao chac chan chua co item nao nen gan thang.
        cart_row = CartRow(user_id=user_id, items=[])
        session.add(cart_row)
        await session.flush()
    return cart_row


async def _build_user_cart(session: AsyncSession, user_id: str, use_cache: bool = True) -> Cart:
    if use_cache:
        cached = await redis_client.get(_user_cache_key(user_id))
        if cached:
            return Cart.model_validate_json(cached)

    cart_row = await _get_or_create_user_cart_row(session, user_id)
    # Query thang CartItemRow thay vi doc qua cart_row.items: trong cung 1 session,
    # neu quan he "items" da duoc nap (selectin) tu truoc do trong request, no se
    # khong tu refresh sau khi vua insert/xoa item o buoc truoc - doc lai truc tiep
    # tu DB de luon thay du lieu moi nhat vua ghi.
    result = await session.execute(select(CartItemRow).where(CartItemRow.cart_id == cart_row.id))
    raw_items = {row.product_id: row.quantity for row in result.scalars().all()}
    cart = await _enrich(user_id, raw_items)

    await redis_client.set(_user_cache_key(user_id), cart.model_dump_json(), ex=USER_CART_CACHE_TTL)
    return cart


async def _invalidate_user_cache(user_id: str) -> None:
    await redis_client.delete(_user_cache_key(user_id))


# ---------- Endpoints ----------
# Uu tien X-User-Id (gio hang ben) neu co, khong thi fallback ve X-Cart-Id (gio hang an danh).


@router.get("", response_model=Cart)
async def get_cart(
    user_id: str | None = Header(default=None, alias="X-User-Id"),
    cart_id: str | None = Header(default=None, alias="X-Cart-Id"),
    session: AsyncSession = Depends(get_session),
):
    if user_id:
        return await _build_user_cart(session, user_id)
    return await _build_guest_cart(cart_id or str(uuid.uuid4()))


@router.post("/items", response_model=Cart)
async def add_item(
    item: CartItemIn,
    user_id: str | None = Header(default=None, alias="X-User-Id"),
    cart_id: str | None = Header(default=None, alias="X-Cart-Id"),
    session: AsyncSession = Depends(get_session),
):
    product = await products_collection.find_one({"_id": item.product_id})
    if product is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")

    if user_id:
        cart_row = await _get_or_create_user_cart_row(session, user_id)
        result = await session.execute(
            select(CartItemRow).where(
                CartItemRow.cart_id == cart_row.id, CartItemRow.product_id == item.product_id
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            session.add(CartItemRow(cart_id=cart_row.id, product_id=item.product_id, quantity=item.quantity))
        else:
            row.quantity += item.quantity
        await session.commit()
        await _invalidate_user_cache(user_id)
        return await _build_user_cart(session, user_id)

    cart_id = cart_id or str(uuid.uuid4())
    key = _guest_redis_key(cart_id)
    await redis_client.hincrby(key, item.product_id, item.quantity)
    await redis_client.expire(key, settings.cart_ttl_seconds)
    return await _build_guest_cart(cart_id)


@router.delete("/items/{product_id}", response_model=Cart)
async def remove_item(
    product_id: str,
    user_id: str | None = Header(default=None, alias="X-User-Id"),
    cart_id: str | None = Header(default=None, alias="X-Cart-Id"),
    session: AsyncSession = Depends(get_session),
):
    if user_id:
        cart_row = await _get_or_create_user_cart_row(session, user_id)
        await session.execute(
            delete(CartItemRow).where(CartItemRow.cart_id == cart_row.id, CartItemRow.product_id == product_id)
        )
        await session.commit()
        await _invalidate_user_cache(user_id)
        return await _build_user_cart(session, user_id)

    if not cart_id:
        raise HTTPException(status_code=400, detail="Thiếu X-Cart-Id")
    await redis_client.hdel(_guest_redis_key(cart_id), product_id)
    return await _build_guest_cart(cart_id)


@router.delete("", status_code=204)
async def clear_cart(
    user_id: str | None = Header(default=None, alias="X-User-Id"),
    cart_id: str | None = Header(default=None, alias="X-Cart-Id"),
    session: AsyncSession = Depends(get_session),
):
    if user_id:
        cart_row = await _get_or_create_user_cart_row(session, user_id)
        await session.execute(delete(CartItemRow).where(CartItemRow.cart_id == cart_row.id))
        await session.commit()
        await _invalidate_user_cache(user_id)
        return

    if not cart_id:
        raise HTTPException(status_code=400, detail="Thiếu X-Cart-Id")
    await redis_client.delete(_guest_redis_key(cart_id))


@router.post("/merge", response_model=Cart)
async def merge_guest_cart(
    payload: MergeCartIn,
    user_id: str = Header(alias="X-User-Id"),
    session: AsyncSession = Depends(get_session),
):
    """Goi ngay sau khi dang nhap: gop gio hang an danh (Redis, truoc luc dang nhap)
    vao gio hang ben cua user (Postgres) - giong cach Shopee gop gio hang khach vao
    tai khoan luc login."""
    guest_key = _guest_redis_key(payload.guest_cart_id)
    raw = await redis_client.hgetall(guest_key)
    if raw:
        cart_row = await _get_or_create_user_cart_row(session, user_id)
        for product_id, qty in raw.items():
            result = await session.execute(
                select(CartItemRow).where(
                    CartItemRow.cart_id == cart_row.id, CartItemRow.product_id == product_id
                )
            )
            row = result.scalar_one_or_none()
            if row is None:
                session.add(CartItemRow(cart_id=cart_row.id, product_id=product_id, quantity=int(qty)))
            else:
                row.quantity += int(qty)
        await session.commit()
        await redis_client.delete(guest_key)
        await _invalidate_user_cache(user_id)

    return await _build_user_cart(session, user_id)
