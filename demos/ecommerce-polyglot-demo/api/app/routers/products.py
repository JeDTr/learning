from fastapi import APIRouter, HTTPException

from app.db.mongodb import products_collection
from app.models.schemas import Product

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[Product])
async def list_products(category: str | None = None, search: str | None = None):
    query: dict = {}
    if category:
        query["category"] = category
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    cursor = products_collection.find(query)
    return [doc async for doc in cursor]


@router.get("/{product_id}", response_model=Product)
async def get_product(product_id: str):
    doc = await products_collection.find_one({"_id": product_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
    return doc
