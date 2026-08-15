# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

LIMIT = 100  # số request tối đa
WINDOW_SECONDS = 60  # trong mỗi phút


async def check_rate_limit(user_id: str):
    window = datetime.utcnow().strftime("%Y-%m-%dT%H:%M")
    key = f"ratelimit:user:{user_id}:{window}"

    current = await r.incr(key)
    if current == 1:
        await r.expire(key, WINDOW_SECONDS)

    if current > LIMIT:
        raise HTTPException(status_code=429, detail="rate limit exceeded")


@app.get("/api/data")
async def get_data(request: Request, user_id: str):
    await check_rate_limit(user_id)
    return {"data": "ok", "user_id": user_id}
