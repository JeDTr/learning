# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI, HTTPException
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

# Lua script: atomic tuyệt đối, có logic điều kiện (transaction MULTI/EXEC thường không làm được)
TRANSFER_SCRIPT = """
local from_balance = tonumber(redis.call('GET', KEYS[1]) or '0')
local amount = tonumber(ARGV[1])
if from_balance < amount then
    return -1
end
redis.call('DECRBY', KEYS[1], amount)
redis.call('INCRBY', KEYS[2], amount)
return 1
"""


@app.post("/transfer/lua")
async def transfer_via_lua(from_account: str, to_account: str, amount: int):
    """Cách 1: Lua script - atomic tuyệt đối, dừng ngay nếu số dư không đủ."""
    result = await r.eval(TRANSFER_SCRIPT, 2, f"account:{from_account}", f"account:{to_account}", amount)
    if result == -1:
        raise HTTPException(status_code=400, detail="insufficient balance")
    return {"from": from_account, "to": to_account, "amount": amount, "status": "transferred"}


@app.post("/transfer/watch")
async def transfer_via_watch(from_account: str, to_account: str, amount: int):
    """Cách 2: WATCH + MULTI/EXEC - optimistic lock, tự retry nếu bị đụng độ (giới hạn 5 lần thử)."""
    from_key, to_key = f"account:{from_account}", f"account:{to_account}"

    for _ in range(5):
        async with r.pipeline() as pipe:
            await pipe.watch(from_key)
            balance = int(await pipe.get(from_key) or 0)

            if balance < amount:
                await pipe.reset()
                raise HTTPException(status_code=400, detail="insufficient balance")

            pipe.multi()
            pipe.decrby(from_key, amount)
            pipe.incrby(to_key, amount)
            try:
                await pipe.execute()  # trả lỗi WatchError nếu from_key bị đổi bởi client khác kể từ WATCH
                return {"from": from_account, "to": to_account, "amount": amount, "status": "transferred"}
            except redis.WatchError:
                continue  # dữ liệu bị đụng độ, thử lại từ đầu

    raise HTTPException(status_code=409, detail="too many concurrent conflicts, please retry")
