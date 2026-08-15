# pip install fastapi redis uvicorn
# uvicorn fastapi_streams_example:app --reload
# worker chạy riêng: python fastapi_streams_example.py worker

import asyncio
import sys

from fastapi import FastAPI
import redis.asyncio as redis
from redis.exceptions import ResponseError

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

STREAM_KEY = "stream:emails"
GROUP_NAME = "email_workers"
CONSUMER_NAME = "worker-1"


async def ensure_group():
    try:
        await r.xgroup_create(STREAM_KEY, GROUP_NAME, id="0", mkstream=True)
    except ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


@app.on_event("startup")
async def on_startup():
    await ensure_group()


@app.post("/emails/send")
async def enqueue_email(to: str, template: str = "welcome"):
    job_id = await r.xadd(STREAM_KEY, {"to": to, "template": template})
    return {"job_id": job_id}


async def run_worker():
    await ensure_group()
    print("worker started, waiting for jobs...")
    while True:
        # ">" nghĩa là "chỉ lấy job mới, chưa ai trong group xử lý"
        resp = await r.xreadgroup(GROUP_NAME, CONSUMER_NAME, {STREAM_KEY: ">"}, count=1, block=5000)
        if not resp:
            continue
        _, messages = resp[0]
        for msg_id, fields in messages:
            try:
                print(f"sending email to {fields['to']} using template {fields['template']}")
                # xử lý gửi email thật ở đây
                await r.xack(STREAM_KEY, GROUP_NAME, msg_id)  # báo đã xử lý xong
            except Exception as exc:
                print(f"job {msg_id} failed: {exc}")  # không ack -> vẫn nằm trong pending list để retry


async def reclaim_stuck_jobs():
    # chạy định kỳ (worker/cron riêng): "cướp lại" job bị treo quá 60s (worker cũ crash giữa chừng)
    while True:
        await r.xautoclaim(STREAM_KEY, GROUP_NAME, CONSUMER_NAME, min_idle_time=60_000, start_id="0")
        await asyncio.sleep(30)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "worker":
        asyncio.run(run_worker())
