ARTICLES_INDEX = "demo_articles"
LOGS_INDEX = "demo_logs"
FRONTEND_LOGS_INDEX = "demo_frontend_logs"

# Custom analyzer "vi_folding": lowercase + asciifolding giúp tìm được cả khi
# gõ không dấu (vd: "may tinh" vẫn khớp "máy tính") — không cần cài thêm plugin
# tiếng Việt riêng, dùng được ngay trên Elastic Cloud.
ARTICLES_MAPPING = {
    "settings": {
        "analysis": {
            "analyzer": {
                "vi_folding": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "asciifolding"],
                }
            }
        }
    },
    "mappings": {
        "properties": {
            "title": {
                "type": "text",
                "analyzer": "vi_folding",
                "fields": {"keyword": {"type": "keyword"}},
            },
            "content": {"type": "text", "analyzer": "vi_folding"},
            "category": {"type": "keyword"},
            "tags": {"type": "keyword"},
            "published_at": {"type": "date"},
        }
    },
}

LOGS_MAPPING = {
    "mappings": {
        "properties": {
            "timestamp": {"type": "date"},
            "method": {"type": "keyword"},
            "path": {"type": "keyword"},
            "status_code": {"type": "integer"},
            "duration_ms": {"type": "float"},
            "client_ip": {"type": "ip"},
        }
    }
}

FRONTEND_LOGS_MAPPING = {
    "mappings": {
        "properties": {
            "timestamp": {"type": "date"},
            "level": {"type": "keyword"},
            "message": {"type": "text", "fields": {"keyword": {"type": "keyword", "ignore_above": 512}}},
            "url": {"type": "keyword"},
            "stack": {"type": "text"},
            "user_agent": {"type": "text"},
        }
    }
}
