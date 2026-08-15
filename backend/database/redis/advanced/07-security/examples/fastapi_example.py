# pip install fastapi "redis[hiredis]" uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI
import redis.asyncio as redis

app = FastAPI()

# Kết nối bằng ACL user riêng (không dùng chung password cho mọi service) + TLS
r = redis.Redis(
    host="redis.internal",
    port=6380,
    username="app_readonly",          # user được tạo bằng ACL SETUSER, chỉ có quyền đọc key "product:*"
    password="app_readonly_password",
    ssl=True,
    ssl_ca_certs="/etc/redis/ca.crt",
    decode_responses=True,
)


@app.get("/products/{product_id}")
async def get_product(product_id: str):
    # user app_readonly chỉ có quyền GET/MGET trên prefix "product:*" (xem advanced/07-security/README.md)
    data = await r.get(f"product:{product_id}")
    return {"product_id": product_id, "data": data}
