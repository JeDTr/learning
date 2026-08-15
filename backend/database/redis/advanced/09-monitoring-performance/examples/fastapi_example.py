# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)


@app.get("/health/redis")
async def redis_health():
    """Health-check endpoint gọn cho load balancer/uptime monitor."""
    try:
        await r.ping()  # chỉ để xác nhận Redis còn phản hồi
        return {"status": "ok"}
    except redis.ConnectionError:
        return {"status": "down"}


@app.get("/admin/metrics/redis")
async def redis_metrics():
    """Chỉ số chi tiết hơn cho dashboard nội bộ (không public)."""
    stats = await r.info("stats")
    memory = await r.info("memory")
    clients = await r.info("clients")

    hits = int(stats.get("keyspace_hits", 0))
    misses = int(stats.get("keyspace_misses", 0))
    total = hits + misses

    return {
        "ops_per_sec": stats.get("instantaneous_ops_per_sec"),
        "connected_clients": clients.get("connected_clients"),
        "used_memory_human": memory.get("used_memory_human"),
        "evicted_keys": stats.get("evicted_keys"),
        "hit_rate_pct": round(hits / total * 100, 1) if total else None,
    }


@app.get("/admin/slowlog")
async def slowlog(count: int = 10):
    entries = await r.slowlog_get(count)
    return [
        {
            "id": e["id"],
            "duration_us": e["duration"],
            "command": " ".join(e["command"]),
        }
        for e in entries
    ]
