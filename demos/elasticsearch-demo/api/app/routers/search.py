from fastapi import APIRouter, Query
from elasticsearch.helpers import async_bulk

from ..es_client import es
from ..indices import ARTICLES_INDEX
from ..seed_data import ARTICLES

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("/seed")
async def seed():
    """Seed lại dữ liệu mẫu (idempotent: dùng _id cố định nên chạy lại chỉ overwrite)."""
    actions = [{"_index": ARTICLES_INDEX, "_id": a["id"], "_source": a} for a in ARTICLES]
    await async_bulk(es, actions)
    await es.indices.refresh(index=ARTICLES_INDEX)
    return {"seeded": len(actions)}


@router.get("")
async def search(
    q: str = Query(..., min_length=1, description="Từ khóa tìm kiếm"),
    category: str | None = Query(None, description="Lọc theo category (Database/Backend/DevOps/Architecture)"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
):
    """Full-text search: multi_match trên title (boost x2) + content, fuzziness AUTO
    (chịu được gõ sai vài ký tự), kèm highlight đoạn khớp và filter theo category."""
    must = [
        {
            "multi_match": {
                "query": q,
                "fields": ["title^2", "content"],
                "fuzziness": "AUTO",
            }
        }
    ]
    filters = [{"term": {"category": category}}] if category else []

    resp = await es.search(
        index=ARTICLES_INDEX,
        query={"bool": {"must": must, "filter": filters}},
        highlight={
            "fields": {
                "title": {},
                "content": {"fragment_size": 150, "number_of_fragments": 1},
            }
        },
        from_=(page - 1) * size,
        size=size,
    )

    total = resp["hits"]["total"]["value"]

    results = []
    for hit in resp["hits"]["hits"]:
        source = hit["_source"]
        highlight = hit.get("highlight", {})
        results.append(
            {
                "id": hit["_id"],
                "score": hit["_score"],
                "title": highlight.get("title", [source["title"]])[0],
                "snippet": highlight.get("content", [source["content"][:150]])[0],
                "category": source["category"],
                "tags": source["tags"],
                "published_at": source["published_at"],
            }
        )

    return {"total": total, "page": page, "size": size, "results": results}


@router.get("/suggest")
async def suggest(q: str = Query(..., min_length=1)):
    """Autocomplete đơn giản: match_phrase_prefix trên title."""
    resp = await es.search(
        index=ARTICLES_INDEX,
        query={"match_phrase_prefix": {"title": q}},
        size=5,
        source=["title"],
    )
    return [hit["_source"]["title"] for hit in resp["hits"]["hits"]]


@router.get("/categories")
async def categories():
    """Facet count theo category — nền tảng cho bộ lọc kiểu 'Database (5)' trên UI."""
    resp = await es.search(
        index=ARTICLES_INDEX,
        size=0,
        aggs={"by_category": {"terms": {"field": "category"}}},
    )
    buckets = resp["aggregations"]["by_category"]["buckets"]
    return [{"category": b["key"], "count": b["doc_count"]} for b in buckets]
