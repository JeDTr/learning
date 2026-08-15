# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)


@app.get("/admin/persistence/status")
async def persistence_status():
    info = await r.info("persistence")
    return {
        "rdb_last_save_time": info.get("rdb_last_save_time"),
        "rdb_bgsave_in_progress": bool(info.get("rdb_bgsave_in_progress")),
        "rdb_last_bgsave_status": info.get("rdb_last_bgsave_status"),
        "aof_enabled": bool(info.get("aof_enabled")),
        "aof_rewrite_in_progress": bool(info.get("aof_rewrite_in_progress")),
        "aof_last_bgrewrite_status": info.get("aof_last_bgrewrite_status"),
    }


@app.post("/admin/persistence/bgsave")
async def trigger_bgsave():
    await r.bgsave()
    return {"triggered": "BGSAVE"}


@app.post("/admin/persistence/bgrewriteaof")
async def trigger_bgrewriteaof():
    await r.bgrewriteaof()
    return {"triggered": "BGREWRITEAOF"}
