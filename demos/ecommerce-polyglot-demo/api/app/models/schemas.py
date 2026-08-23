from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ---- Products (Mongo) ----

class Product(BaseModel):
    id: str = Field(alias="_id")
    name: str
    description: str
    price: float
    category: str
    image: str
    stock: int

    class Config:
        populate_by_name = True


# ---- Cart (Redis) ----

class CartItemIn(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)


class CartItemOut(BaseModel):
    product_id: str
    name: str
    price: float
    image: str
    quantity: int
    subtotal: float


class Cart(BaseModel):
    cart_id: str
    items: list[CartItemOut]
    total: float


class MergeCartIn(BaseModel):
    guest_cart_id: str


# ---- Auth (Postgres) - dang nhap gia lap, chi de gan gio hang vao user, khong phai auth that ----

class LoginIn(BaseModel):
    email: EmailStr
    name: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str

    class Config:
        from_attributes = True


# ---- Checkout / Orders (Postgres) ----

class PaymentIn(BaseModel):
    card_number: str = Field(min_length=12, max_length=19)
    card_holder: str
    expiry: str
    cvv: str = Field(min_length=3, max_length=4)


class CheckoutIn(BaseModel):
    customer_name: str
    customer_email: EmailStr
    shipping_address: str
    payment: PaymentIn


class PaymentOut(BaseModel):
    status: str
    method: str
    card_last4: str
    created_at: datetime

    class Config:
        from_attributes = True


class OrderItemOut(BaseModel):
    product_id: str
    product_name: str
    unit_price: float
    quantity: int

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: str
    customer_name: str
    customer_email: str
    shipping_address: str
    status: str
    total_amount: float
    created_at: datetime
    items: list[OrderItemOut]
    payment: PaymentOut | None

    class Config:
        from_attributes = True
