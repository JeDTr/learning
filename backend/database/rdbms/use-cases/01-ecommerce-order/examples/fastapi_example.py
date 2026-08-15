# pip install fastapi sqlalchemy psycopg2-binary uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI, HTTPException
from sqlalchemy import (
    create_engine, Column, BigInteger, String, Numeric, Integer, ForeignKey,
    CheckConstraint, TIMESTAMP, func,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

engine = create_engine("postgresql://user:pass@localhost/shop")
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()
app = FastAPI()


class User(Base):
    __tablename__ = "users"
    id = Column(BigInteger, primary_key=True)
    email = Column(String, nullable=False, unique=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Product(Base):
    __tablename__ = "products"
    id = Column(BigInteger, primary_key=True)
    name = Column(String, nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    stock_qty = Column(Integer, nullable=False)
    __table_args__ = (CheckConstraint("stock_qty >= 0"),)


class Order(Base):
    __tablename__ = "orders"
    id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    status = Column(String, nullable=False, default="pending")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    __table_args__ = (CheckConstraint("status IN ('pending','paid','shipped','cancelled')"),)


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(BigInteger, primary_key=True)
    order_id = Column(BigInteger, ForeignKey("orders.id"), nullable=False)
    product_id = Column(BigInteger, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)  # snapshot giá lúc mua, KHÔNG đọc lại products.price


@app.post("/orders/{order_id}/items")
def add_item(order_id: int, product_id: int, quantity: int):
    db: Session = SessionLocal()
    try:
        # SELECT ... FOR UPDATE: khoá hàng product để 2 request cùng lúc không cùng đọc stock cũ
        product = db.query(Product).filter(Product.id == product_id).with_for_update().one()
        if product.stock_qty < quantity:
            raise HTTPException(400, "Không đủ tồn kho")

        product.stock_qty -= quantity
        db.add(OrderItem(
            order_id=order_id,
            product_id=product_id,
            quantity=quantity,
            unit_price=product.price,  # snapshot giá tại thời điểm mua
        ))
        db.commit()
        return {"status": "ok", "remaining_stock": product.stock_qty}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
