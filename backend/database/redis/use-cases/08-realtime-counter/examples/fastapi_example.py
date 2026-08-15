# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)


@app.post("/posts/{post_id}/view")
async def add_view(post_id: str):
    views = await r.incr(f"post:{post_id}:views")
    return {"post_id": post_id, "views": views}


@app.post("/posts/{post_id}/like")
async def like_post(post_id: str, user_id: str):
    # SADD đảm bảo mỗi user chỉ like 1 lần (unique)
    added = await r.sadd(f"post:{post_id}:liked_by", user_id)
    if added:
        await r.incr(f"post:{post_id}:likes")
    likes = await r.get(f"post:{post_id}:likes") or 0
    return {"post_id": post_id, "likes": int(likes)}


@app.get("/users/online/count")
async def online_users_count():
    count = await r.scard("online_users")
    return {"online": count}
