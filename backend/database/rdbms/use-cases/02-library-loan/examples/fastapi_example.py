# pip install fastapi sqlalchemy psycopg2-binary uvicorn
# uvicorn fastapi_example:app --reload

from datetime import datetime

from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine, Column, BigInteger, TIMESTAMP, func
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.exc import IntegrityError

engine = create_engine("postgresql://user:pass@localhost/library")
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()
app = FastAPI()


class Loan(Base):
    __tablename__ = "loans"
    id = Column(BigInteger, primary_key=True)
    book_copy_id = Column(BigInteger, nullable=False)
    member_id = Column(BigInteger, nullable=False)
    borrowed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    due_at = Column(TIMESTAMP(timezone=True), nullable=False)
    returned_at = Column(TIMESTAMP(timezone=True), nullable=True)  # NULL = đang được mượn


# Migration tạo bảng + partial unique index (xem DDL đầy đủ ở ../../README.md):
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
