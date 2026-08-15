# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI
import redis.asyncio as redis

app = FastAPI()

# Read/write splitting: ghi luôn qua master, đọc có thể qua replica để giảm tải cho master
master = redis.Redis(host="master.redis.internal", port=6379, decode_responses=True)
replica = redis.Redis(host="replica.redis.internal", port=6379, decode_responses=True)


@app.post("/products/{product_id}/views")
async def increment_views(product_id: str):
    # ghi -> luôn qua master
    views = await master.incr(f"product:{product_id}:views")
    return {"product_id": product_id, "views": views}


@app.get("/products/{product_id}/views")
async def get_views(product_id: str):
    # đọc -> có thể qua replica, chấp nhận độ trễ replication vài ms
    views = await replica.get(f"product:{product_id}:views")
    return {"product_id": product_id, "views": int(views or 0)}
