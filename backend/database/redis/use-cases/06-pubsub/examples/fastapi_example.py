# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload
# subscriber chạy riêng: python fastapi_example.py subscribe room1

import asyncio
import json
import sys

from fastapi import FastAPI
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)


@app.post("/chat/{room}/publish")
async def publish_message(room: str, user: str, msg: str):
    payload = json.dumps({"user": user, "msg": msg})
    subscribers = await r.publish(f"chat:{room}", payload)
    return {"published": True, "subscribers_notified": subscribers}


async def run_subscriber(room: str):
    pubsub = r.pubsub()
    await pubsub.subscribe(f"chat:{room}")
    print(f"subscribed to chat:{room}, waiting for messages...")
    async for message in pubsub.listen():
        if message["type"] == "message":
            data = json.loads(message["data"])
            print(f"[{room}] {data['user']}: {data['msg']}")


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "subscribe":
        asyncio.run(run_subscriber(sys.argv[2]))
