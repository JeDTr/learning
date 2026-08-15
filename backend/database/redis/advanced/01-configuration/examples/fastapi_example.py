# pip install fastapi redis uvicorn
# uvicorn fastapi_example:app --reload

from fastapi import FastAPI
import redis.asyncio as redis

app = FastAPI()

# Kết nối có áp dụng các option cấu hình quan trọng (khớp advanced/01-configuration/README.md)
r = redis.Redis(
    host="localhost",
    port=6379,
    password="your_strong_password",  # khớp 'requirepass' trong redis.conf
    socket_timeout=5,                  # timeout cho mỗi lệnh, tránh app treo nếu Redis không phản hồi
    socket_connect_timeout=5,
    decode_responses=True,
)


@app.get("/admin/config/{key}")
async def get_config(key: str):
    """Đọc 1 directive đang áp dụng lúc runtime, vd: maxmemory, maxmemory-policy."""
    result = await r.config_get(key)
    return result


@app.put("/admin/config/{key}")
async def set_config(key: str, value: str):
    """Đổi config lúc runtime. Lưu ý: chưa persist xuống file, cần gọi thêm /admin/config/rewrite."""
    await r.config_set(key, value)
    return {key: value}


@app.post("/admin/config/rewrite")
async def rewrite_config():
    """Ghi lại toàn bộ config runtime hiện tại xuống file redis.conf, để giữ sau khi restart."""
    await r.config_rewrite()
    return {"rewritten": True}
