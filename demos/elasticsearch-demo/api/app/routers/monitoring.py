import random
from datetime import datetime, timezone

from elasticsearch.helpers import async_bulk
from fastapi import APIRouter, Query

from ..es_client import es
from ..indices import LOGS_INDEX

# Monitoring (dashboard, log search, cluster health) là việc của Kibana — không
# tự code lại ở đây. Router này chỉ còn 1 việc: sinh dữ liệu demo (log vào
# demo_logs) để có gì đó cho Kibana Discover/Dashboards nhìn vào.
router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])

_SAMPLE_PATHS = [
    "/api/search",
    "/api/search/suggest",
    "/api/search/categories",
    "/api/monitoring/simulate",
]


@router.post("/simulate")
async def simulate_traffic(count: int = Query(50, ge=1, le=500)):
    """Sinh log giả lập vào demo_logs để có dữ liệu demo ngay trong Kibana mà
    không cần gọi API thật nhiều lần — mô phỏng traffic với tỉ lệ lỗi ~10% và
    latency lỗi cao hơn hẳn."""
    now = datetime.now(timezone.utc)
    actions = []
    for _ in range(count):
        status = random.choices(
            [200, 201, 400, 404, 500, 503],
            weights=[65, 15, 8, 5, 4, 3],
        )[0]
        is_error = status >= 500
        doc = {
            "timestamp": now.isoformat(),
            "method": random.choice(["GET", "POST"]),
            "path": random.choice(_SAMPLE_PATHS),
            "status_code": status,
            "duration_ms": round(max(1.0, random.gauss(700, 150) if is_error else random.gauss(90, 40)), 2),
            "client_ip": f"10.0.{random.randint(0, 255)}.{random.randint(1, 254)}",
        }
        actions.append({"_index": LOGS_INDEX, "_source": doc})

    await async_bulk(es, actions)
    await es.indices.refresh(index=LOGS_INDEX)
    return {"simulated": count}
