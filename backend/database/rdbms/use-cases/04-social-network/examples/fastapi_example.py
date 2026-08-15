# pip install fastapi sqlalchemy psycopg2-binary uvicorn

from fastapi import FastAPI
from sqlalchemy import (
    create_engine, Column, BigInteger, String, Text, ForeignKey, TIMESTAMP, func,
    select, literal,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session, aliased

engine = create_engine("postgresql://user:pass@localhost/social")
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()
app = FastAPI()


class User(Base):
    __tablename__ = "users"
    id = Column(BigInteger, primary_key=True)
    email = Column(String, nullable=False, unique=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Post(Base):
    __tablename__ = "posts"
    id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Comment(Base):
    __tablename__ = "comments"
    id = Column(BigInteger, primary_key=True)
    post_id = Column(BigInteger, ForeignKey("posts.id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    parent_comment_id = Column(BigInteger, ForeignKey("comments.id"), nullable=True)  # self-reference
    content = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Like(Base):
    __tablename__ = "likes"
    user_id = Column(BigInteger, ForeignKey("users.id"), primary_key=True)
    post_id = Column(BigInteger, ForeignKey("posts.id"), primary_key=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Follow(Base):
    __tablename__ = "follows"
    follower_id = Column(BigInteger, ForeignKey("users.id"), primary_key=True)
    followee_id = Column(BigInteger, ForeignKey("users.id"), primary_key=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


def build_thread_query(post_id: int):
    # Anchor: các comment gốc (không có parent) của bài viết — dùng .cte(recursive=True)
    # của SQLAlchemy thay vì viết chuỗi "WITH RECURSIVE" tay
    anchor = (
        select(
            Comment.id, Comment.parent_comment_id, Comment.user_id,
            Comment.content, Comment.created_at, literal(0).label("depth"),
        )
        .where(Comment.post_id == post_id, Comment.parent_comment_id.is_(None))
        .cte("thread", recursive=True)
    )

    # Recursive term: join các reply vào chính CTE đang xây dựng
    c = aliased(Comment)
    recursive_term = select(
        c.id, c.parent_comment_id, c.user_id, c.content, c.created_at, anchor.c.depth + 1,
    ).join(anchor, c.parent_comment_id == anchor.c.id)

    thread = anchor.union_all(recursive_term)
    return select(thread).order_by(thread.c.depth, thread.c.created_at)


@app.get("/posts/{post_id}/comments/thread")
def get_comment_thread(post_id: int):
    db: Session = SessionLocal()
    rows = db.execute(build_thread_query(post_id)).mappings().all()
    db.close()
    return list(rows)
