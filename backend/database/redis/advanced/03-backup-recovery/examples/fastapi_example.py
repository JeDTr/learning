# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)


@app.post("/admin/backup/trigger")
async def trigger_backup():
    """Kích hoạt backup an toàn: từ chối nếu đã có BGSAVE khác đang chạy, tránh chồng chéo I/O."""
    info = await r.info("persistence")
    if info.get("rdb_bgsave_in_progress"):
        raise HTTPException(status_code=409, detail="a BGSAVE is already in progress")

    await r.bgsave()
    return {"triggered": True}


@app.get("/admin/backup/last")
async def last_backup():
    """Trả về thời điểm snapshot RDB gần nhất, để dashboard/alert theo dõi backup có bị trễ không."""
    timestamp = await r.lastsave()
    last_save = datetime.fromtimestamp(timestamp, tz=timezone.utc)
    age_seconds = (datetime.now(tz=timezone.utc) - last_save).total_seconds()
    return {
        "last_save_at": last_save.isoformat(),
        "age_seconds": int(age_seconds),
        "stale": age_seconds > 24 * 3600,  # cảnh báo nếu backup gần nhất quá 24h
    }
