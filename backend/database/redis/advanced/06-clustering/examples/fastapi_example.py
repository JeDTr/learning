# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI
from redis.asyncio.cluster import RedisCluster

app = FastAPI()

# Client cluster-aware: tự biết bảng hash slot, tự redirect (MOVED/ASK) khi cần
rc = RedisCluster(host="127.0.0.1", port=7000, decode_responses=True)


@app.post("/users/{user_id}/profile")
async def set_profile(user_id: str, name: str):
    # dùng hash tag {user_id} để đảm bảo profile + settings của cùng 1 user nằm cùng 1 slot
    await rc.set(f"user:{{{user_id}}}:profile", name)
    return {"user_id": user_id, "name": name}


@app.post("/users/{user_id}/settings")
async def set_settings(user_id: str, theme: str):
    await rc.set(f"user:{{{user_id}}}:settings", theme)
    return {"user_id": user_id, "theme": theme}


@app.get("/users/{user_id}")
async def get_user(user_id: str):
    # MGET nhiều key chỉ hợp lệ trong cluster nếu tất cả key cùng hash slot -> nhờ hash tag ở trên
    profile, settings = await rc.mget(f"user:{{{user_id}}}:profile", f"user:{{{user_id}}}:settings")
    return {"user_id": user_id, "name": profile, "theme": settings}
