# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI
from redis.asyncio.sentinel import Sentinel

app = FastAPI()

# Client không kết nối thẳng vào 1 IP master cố định, mà hỏi Sentinel "master hiện tại là ai"
sentinel = Sentinel(
    [("sentinel1.internal", 26379), ("sentinel2.internal", 26379), ("sentinel3.internal", 26379)],
    socket_timeout=0.5,
)

MASTER_NAME = "mymaster"


@app.post("/orders/{order_id}")
async def create_order(order_id: str):
    # ghi -> luôn qua master hiện tại (Sentinel tự động trả đúng node, kể cả sau khi failover)
    master = sentinel.master_for(MASTER_NAME, decode_responses=True)
    await master.set(f"order:{order_id}", "created")
    return {"order_id": order_id, "status": "created"}


@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    # đọc -> có thể qua replica đang được Sentinel giám sát
    replica = sentinel.slave_for(MASTER_NAME, decode_responses=True)
    status = await replica.get(f"order:{order_id}")
    return {"order_id": order_id, "status": status}
