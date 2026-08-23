from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings

_client = AsyncIOMotorClient(settings.mongo_url)
db = _client[settings.mongo_db]
products_collection = db["products"]
