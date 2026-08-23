from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongo_url: str = "mongodb://mongo:27017"
    mongo_db: str = "catalog"

    postgres_url: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/orders"

    redis_url: str = "redis://redis:6379/0"

    cart_ttl_seconds: int = 60 * 60 * 24 * 7  # 7 ngay


settings = Settings()
