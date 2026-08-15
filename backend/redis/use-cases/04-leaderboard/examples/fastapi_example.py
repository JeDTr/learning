# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI, HTTPException
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

LEADERBOARD_KEY = "leaderboard:game1"


@app.post("/score/{player_id}")
async def set_score(player_id: str, score: float):
    await r.zadd(LEADERBOARD_KEY, {player_id: score})
    return {"player_id": player_id, "score": score}


@app.post("/score/{player_id}/increment")
async def increment_score(player_id: str, delta: float):
    new_score = await r.zincrby(LEADERBOARD_KEY, delta, player_id)
    return {"player_id": player_id, "score": new_score}


@app.get("/leaderboard/top/{n}")
async def top_players(n: int = 10):
    results = await r.zrevrange(LEADERBOARD_KEY, 0, n - 1, withscores=True)
    return [{"player_id": pid, "score": score} for pid, score in results]


@app.get("/leaderboard/rank/{player_id}")
async def player_rank(player_id: str):
    rank = await r.zrevrank(LEADERBOARD_KEY, player_id)
    if rank is None:
        raise HTTPException(status_code=404, detail="player not found")
    score = await r.zscore(LEADERBOARD_KEY, player_id)
    return {"player_id": player_id, "rank": rank + 1, "score": score}
