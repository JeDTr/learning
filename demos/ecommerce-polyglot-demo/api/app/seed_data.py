from app.db.mongodb import products_collection

SAMPLE_PRODUCTS = [
    {
        "_id": "p1",
        "name": "Bàn phím cơ Keychron K8",
        "description": "Bàn phím cơ không dây, hotswap switch, layout 87 phím.",
        "price": 89.99,
        "category": "Phụ kiện",
        "image": "https://placehold.co/400x300?text=Keychron+K8",
        "stock": 25,
    },
    {
        "_id": "p2",
        "name": "Chuột Logitech MX Master 3S",
        "description": "Chuột không dây cao cấp, cảm biến 8000 DPI, click im.",
        "price": 99.0,
        "category": "Phụ kiện",
        "image": "https://placehold.co/400x300?text=MX+Master+3S",
        "stock": 40,
    },
    {
        "_id": "p3",
        "name": "Màn hình Dell 27\" 4K",
        "description": "Màn hình IPS 4K 27 inch, 99% sRGB, hỗ trợ USB-C 90W.",
        "price": 429.5,
        "category": "Màn hình",
        "image": "https://placehold.co/400x300?text=Dell+27+4K",
        "stock": 12,
    },
    {
        "_id": "p4",
        "name": "SSD Samsung 990 Pro 2TB",
        "description": "NVMe Gen4, tốc độ đọc lên đến 7450MB/s.",
        "price": 149.99,
        "category": "Lưu trữ",
        "image": "https://placehold.co/400x300?text=990+Pro+2TB",
        "stock": 60,
    },
    {
        "_id": "p5",
        "name": "Tai nghe Sony WH-1000XM5",
        "description": "Chống ồn chủ động hàng đầu, pin 30 giờ.",
        "price": 349.99,
        "category": "Âm thanh",
        "image": "https://placehold.co/400x300?text=WH-1000XM5",
        "stock": 18,
    },
    {
        "_id": "p6",
        "name": "Webcam Logitech Brio 500",
        "description": "1080p 60fps, HDR, tự động lấy nét, mic khử ồn.",
        "price": 69.99,
        "category": "Phụ kiện",
        "image": "https://placehold.co/400x300?text=Brio+500",
        "stock": 33,
    },
]


async def seed_products_if_empty() -> None:
    count = await products_collection.count_documents({})
    if count == 0:
        await products_collection.insert_many(SAMPLE_PRODUCTS)
