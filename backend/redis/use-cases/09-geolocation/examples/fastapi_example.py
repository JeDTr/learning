# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

SHIPPERS_KEY = "shippers"


@app.post("/shippers/{shipper_id}/location")
async def update_location(shipper_id: str, lon: float, lat: float):
    await r.geoadd(SHIPPERS_KEY, (lon, lat, shipper_id))
    return {"shipper_id": shipper_id, "lon": lon, "lat": lat}


@app.get("/shippers/nearby")
async def find_nearby_shippers(lon: float, lat: float, radius_km: float = 2):
    results = await r.geosearch(
        SHIPPERS_KEY,
        longitude=lon,
        latitude=lat,
        radius=radius_km,
        unit="km",
        withdist=True,
        sort="ASC",
    )
    return [{"shipper_id": name, "distance_km": float(dist)} for name, dist in results]
