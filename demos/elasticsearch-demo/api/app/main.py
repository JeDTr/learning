from contextlib import asynccontextmanager

from elasticsearch.helpers import async_bulk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .es_client import es
from .indices import (
    ARTICLES_INDEX,
    ARTICLES_MAPPING,
    FRONTEND_LOGS_INDEX,
    FRONTEND_LOGS_MAPPING,
    LOGS_INDEX,
    LOGS_MAPPING,
)
from .logging_middleware import RequestLoggingMiddleware
from .routers import frontend_logs, monitoring, search
from .seed_data import ARTICLES


async def _ensure_index(name: str, mapping: dict) -> None:
    if not await es.indices.exists(index=name):
        await es.indices.create(index=name, **mapping)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _ensure_index(ARTICLES_INDEX, ARTICLES_MAPPING)
    await _ensure_index(LOGS_INDEX, LOGS_MAPPING)
    await _ensure_index(FRONTEND_LOGS_INDEX, FRONTEND_LOGS_MAPPING)

    count = await es.count(index=ARTICLES_INDEX)
    if count["count"] == 0:
        actions = [{"_index": ARTICLES_INDEX, "_id": a["id"], "_source": a} for a in ARTICLES]
        await async_bulk(es, actions)
        await es.indices.refresh(index=ARTICLES_INDEX)

    yield
    await es.close()


app = FastAPI(title="Elasticsearch Demo", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.add_middleware(RequestLoggingMiddleware)

app.include_router(search.router)
app.include_router(monitoring.router)
app.include_router(frontend_logs.router)


@app.get("/api/health")
async def liveness():
    """Liveness probe cho Docker healthcheck — KHÔNG phải dashboard giám sát ES
    (việc đó để Kibana lo). Chỉ xác nhận process FastAPI còn sống."""
    return {"status": "ok"}
