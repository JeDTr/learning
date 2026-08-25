import asyncio
import time
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .es_client import es
from .indices import LOGS_INDEX

# Loại trừ health probe — Docker gọi mỗi 10s, log lại chỉ làm nhiễu demo_logs.
_EXCLUDED_PATHS = {"/api/health"}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Ghi mỗi request /api/* thành 1 document trong demo_logs — mô phỏng
    pattern 'app tự log structured event vào Elasticsearch' để phục vụ
    search/monitoring, thay vì chỉ log ra file/stdout."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            path = request.url.path
            if path.startswith("/api") and path not in _EXCLUDED_PATHS:
                doc = {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "method": request.method,
                    "path": path,
                    "status_code": status_code,
                    "duration_ms": round(duration_ms, 2),
                    "client_ip": request.client.host if request.client else "0.0.0.0",
                }
                # fire-and-forget: không chặn response chỉ vì đang ghi log
                asyncio.create_task(es.index(index=LOGS_INDEX, document=doc))
