from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from ..es_client import es
from ..indices import FRONTEND_LOGS_INDEX

router = APIRouter(prefix="/api/frontend-logs", tags=["frontend-logs"])


class FrontendLogEntry(BaseModel):
    level: str
    message: str
    url: str
    stack: str | None = None
    user_agent: str | None = None


@router.post("")
async def create_frontend_log(entry: FrontendLogEntry):
    """Nhận log (chủ yếu là lỗi JS chưa bắt) từ browser, ghi thẳng vào
    Elasticsearch bằng đúng client/API key backend đang dùng — browser không
    cần biết gì về Elasticsearch, chỉ POST JSON same-origin về đây."""
    doc = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": entry.level,
        "message": entry.message,
        "url": entry.url,
        "stack": entry.stack,
        "user_agent": entry.user_agent,
    }
    await es.index(index=FRONTEND_LOGS_INDEX, document=doc)
    return {"status": "ok"}
