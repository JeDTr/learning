"""Dang nhap gia lap cho demo: chi can email, khong mat khau, khong JWT.

Muc dich duy nhat la co user_id on dinh de gan gio hang ben (Postgres) - khong
phai vi du ve auth an toan. He thong that can password hashing + session/JWT that su.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_session
from app.models.schemas import LoginIn, UserOut
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
async def login(payload: LoginIn, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email=payload.email, name=payload.name)
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user
