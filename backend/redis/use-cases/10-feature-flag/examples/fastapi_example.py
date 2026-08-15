# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

CONFIG_KEY = "config:app"


@app.get("/features/{flag_name}")
async def get_feature(flag_name: str):
    value = await r.get(f"feature:{flag_name}")
    return {"flag": flag_name, "enabled": value == "true"}


@app.put("/features/{flag_name}")
async def set_feature(flag_name: str, enabled: bool):
    await r.set(f"feature:{flag_name}", "true" if enabled else "false")
    return {"flag": flag_name, "enabled": enabled}


@app.get("/config")
async def get_config():
    return await r.hgetall(CONFIG_KEY)


@app.put("/config/{key}")
async def set_config(key: str, value: str):
    await r.hset(CONFIG_KEY, key, value)
    return {key: value}
