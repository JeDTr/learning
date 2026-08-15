# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload
# worker chạy riêng: python fastapi_example.py worker

import asyncio
import json
import sys

from fastapi import FastAPI
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

QUEUE_KEY = "queue:emails"


@app.post("/emails/send")
async def enqueue_email(to: str, template: str = "welcome"):
    job = {"to": to, "template": template}
    await r.lpush(QUEUE_KEY, json.dumps(job))
    return {"enqueued": job}


async def run_worker():
    print("worker started, waiting for jobs...")
    while True:
        _, payload = await r.brpop(QUEUE_KEY)
        job = json.loads(payload)
        print(f"sending email to {job['to']} using template {job['template']}")
        # xử lý gửi email thật ở đây


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "worker":
        asyncio.run(run_worker())
