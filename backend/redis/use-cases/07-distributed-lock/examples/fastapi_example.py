# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

import uuid

from fastapi import FastAPI, HTTPException
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

LOCK_TTL = 10  # giây

# Lua script: chỉ xoá lock nếu value khớp (đúng chủ sở hữu), tránh xoá nhầm lock của process khác
RELEASE_LOCK_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


@app.post("/orders/{order_id}/process")
async def process_order(order_id: str):
    lock_key = f"lock:order:{order_id}"
    token = str(uuid.uuid4())

    acquired = await r.set(lock_key, token, nx=True, ex=LOCK_TTL)
    if not acquired:
        raise HTTPException(status_code=409, detail="order is being processed by another worker")

    try:
        # xử lý đơn hàng ở đây (idempotent, thời gian < LOCK_TTL)
        return {"order_id": order_id, "status": "processed"}
    finally:
        await r.eval(RELEASE_LOCK_SCRIPT, 1, lock_key, token)
