# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

import json

from fastapi import FastAPI
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

TTL_SECONDS = 300


async def fetch_product_from_db(product_id: str) -> dict:
    # giả lập truy vấn DB chậm
    return {"id": product_id, "name": f"Product {product_id}", "price": 99.9}


@app.get("/product/{product_id}")
async def get_product(product_id: str):
    cache_key = f"product:{product_id}"
    cached = await r.get(cache_key)
    if cached:
        return {"source": "cache", "data": json.loads(cached)}

    data = await fetch_product_from_db(product_id)
    await r.set(cache_key, json.dumps(data), ex=TTL_SECONDS)
    return {"source": "db", "data": data}


@app.delete("/product/{product_id}/cache")
async def invalidate_product_cache(product_id: str):
    await r.delete(f"product:{product_id}")
    return {"invalidated": product_id}
