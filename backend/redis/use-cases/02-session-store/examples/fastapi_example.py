# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

import json
import uuid

from fastapi import FastAPI, HTTPException
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

SESSION_TTL = 1800  # 30 phút


@app.post("/session")
async def create_session(user_id: int, role: str = "user"):
    session_id = str(uuid.uuid4())
    payload = {"userId": user_id, "role": role}
    await r.set(f"session:{session_id}", json.dumps(payload), ex=SESSION_TTL)
    return {"session_id": session_id}


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    data = await r.get(f"session:{session_id}")
    if not data:
        raise HTTPException(status_code=404, detail="session not found or expired")
    await r.expire(f"session:{session_id}", SESSION_TTL)  # gia hạn (sliding session)
    return json.loads(data)


@app.delete("/session/{session_id}")
async def logout(session_id: str):
    await r.delete(f"session:{session_id}")
    return {"logged_out": session_id}
