from elasticsearch import AsyncElasticsearch

from .config import settings


def _build_client() -> AsyncElasticsearch:
    if settings.elasticsearch_api_key:
        return AsyncElasticsearch(
            settings.elasticsearch_url,
            api_key=settings.elasticsearch_api_key,
        )
    if settings.elasticsearch_username and settings.elasticsearch_password:
        return AsyncElasticsearch(
            settings.elasticsearch_url,
            basic_auth=(settings.elasticsearch_username, settings.elasticsearch_password),
        )
    raise RuntimeError(
        "Thiếu credential: điền ELASTICSEARCH_API_KEY hoặc "
        "ELASTICSEARCH_USERNAME/ELASTICSEARCH_PASSWORD trong api/.env "
        "(xem api/.env.example)."
    )


es = _build_client()
