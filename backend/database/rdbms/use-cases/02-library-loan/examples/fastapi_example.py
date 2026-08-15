# pip install fastapi sqlalchemy psycopg2-binary uvicorn
# uvicorn fastapi_example:app --reload

from datetime import datetime

from fastapi import FastAPI, HTTPException
from sqlalchemy import (
    create_engine, Column, BigInteger, String, ForeignKey, Table, TIMESTAMP, func,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from sqlalchemy.exc import IntegrityError

engine = create_engine("postgresql://user:pass@localhost/library")
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()
app = FastAPI()

# Bảng trung gian cho quan hệ many-to-many books <-> authors
book_authors = Table(
    "book_authors", Base.metadata,
    Column("book_id", BigInteger, ForeignKey("books.id"), primary_key=True),
    Column("author_id", BigInteger, ForeignKey("authors.id"), primary_key=True),
)


class Author(Base):
    __tablename__ = "authors"
    id = Column(BigInteger, primary_key=True)
    name = Column(String, nullable=False)


class Book(Base):
    __tablename__ = "books"
    id = Column(BigInteger, primary_key=True)
    title = Column(String, nullable=False)
    isbn = Column(String, unique=True)
    authors = relationship("Author", secondary=book_authors)


class BookCopy(Base):
    __tablename__ = "book_copies"
    id = Column(BigInteger, primary_key=True)
    book_id = Column(BigInteger, ForeignKey("books.id"), nullable=False)
    barcode = Column(String, nullable=False, unique=True)


class Member(Base):
    __tablename__ = "members"
    id = Column(BigInteger, primary_key=True)
    name = Column(String, nullable=False)


class Loan(Base):
    __tablename__ = "loans"
    id = Column(BigInteger, primary_key=True)
    book_copy_id = Column(BigInteger, ForeignKey("book_copies.id"), nullable=False)
    member_id = Column(BigInteger, ForeignKey("members.id"), nullable=False)
    borrowed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    due_at = Column(TIMESTAMP(timezone=True), nullable=False)
    returned_at = Column(TIMESTAMP(timezone=True), nullable=True)  # NULL = đang được mượn


# Partial unique index không biểu diễn được qua Column/Table thông thường của SQLAlchemy
# ORM — phải tạo thủ công trong migration (xem DDL đầy đủ ở ../../README.md):
# CREATE UNIQUE INDEX idx_one_active_loan_per_copy ON loans(book_copy_id) WHERE returned_at IS NULL;


@app.post("/loans")
def borrow_book(book_copy_id: int, member_id: int, due_at: datetime):
    db: Session = SessionLocal()
    try:
        db.add(Loan(book_copy_id=book_copy_id, member_id=member_id, due_at=due_at))
        db.commit()
        return {"status": "borrowed"}
    except IntegrityError:
        db.rollback()
        # vi phạm idx_one_active_loan_per_copy: bản sao này đang được mượn
        raise HTTPException(409, "Bản sao sách này đang được người khác mượn")
    finally:
        db.close()


@app.post("/loans/{loan_id}/return")
def return_book(loan_id: int):
    db: Session = SessionLocal()
    loan = db.get(Loan, loan_id)
    if loan is None:
        db.close()
        raise HTTPException(404, "Không tìm thấy lượt mượn")

    loan.returned_at = func.now()
    db.commit()
    db.close()
    return {"status": "returned"}
