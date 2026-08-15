# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)


@app.get("/admin/memory/status")
async def memory_status():
    info = await r.info("memory")
    used = int(info["used_memory"])
    maxmem = int(info.get("maxmemory", 0))
    return {
        "used_memory_human": info.get("used_memory_human"),
        "maxmemory_human": info.get("maxmemory_human"),
        "usage_pct": round(used / maxmem * 100, 1) if maxmem else None,
        "eviction_policy": info.get("maxmemory_policy"),
        "evicted_keys": (await r.info("stats")).get("evicted_keys"),
    }


@app.get("/admin/memory/key/{key}")
async def key_memory_usage(key: str):
    usage = await r.memory_usage(key)
    return {"key": key, "bytes": usage}


@app.put("/admin/memory/policy")
async def set_eviction_policy(policy: str):
    # ví dụ: allkeys-lru, volatile-lru, allkeys-lfu, volatile-ttl, noeviction...
    await r.config_set("maxmemory-policy", policy)
    return {"maxmemory-policy": policy}
