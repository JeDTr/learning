from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.postgres import init_postgres
from app.routers import auth, cart, orders, products
from app.seed_data import seed_products_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_postgres()
    await seed_products_if_empty()
    yield


app = FastAPI(title="Ecommerce Demo API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(auth.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
