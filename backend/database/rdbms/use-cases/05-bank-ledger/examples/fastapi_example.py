# pip install fastapi sqlalchemy psycopg2-binary uvicorn

from fastapi import FastAPI, HTTPException
from sqlalchemy import (
    create_engine, Column, BigInteger, Text, Numeric, ForeignKey, TIMESTAMP, func, select,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

engine = create_engine("postgresql://user:pass@localhost/bank")
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()
app = FastAPI()


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(BigInteger, primary_key=True)
    description = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    id = Column(BigInteger, primary_key=True)
    transaction_id = Column(BigInteger, ForeignKey("transactions.id"), nullable=False)
    account_id = Column(BigInteger, nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)  # dương = ghi Có, âm = ghi Nợ


@app.post("/transfer")
def transfer(from_account: int, to_account: int, amount: float, description: str):
    if amount <= 0:
        raise HTTPException(400, "Số tiền phải > 0")

    db: Session = SessionLocal()
    try:
        tx = Transaction(description=description)
        db.add(tx)
        db.flush()  # có tx.id ngay mà chưa cần commit

        # 2 dòng ghi sổ trong cùng transaction: 1 Nợ, 1 Có — tổng luôn bằng 0
        db.add(LedgerEntry(transaction_id=tx.id, account_id=from_account, amount=-amount))
        db.add(LedgerEntry(transaction_id=tx.id, account_id=to_account, amount=amount))
        db.commit()
        return {"status": "ok", "transaction_id": tx.id}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@app.get("/accounts/{account_id}/balance")
def get_balance(account_id: int):
    db: Session = SessionLocal()
    balance = db.scalar(
        select(func.coalesce(func.sum(LedgerEntry.amount), 0))
        .where(LedgerEntry.account_id == account_id)
    )
    db.close()
    return {"account_id": account_id, "balance": balance}
