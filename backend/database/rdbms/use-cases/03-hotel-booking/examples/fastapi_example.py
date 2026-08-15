# pip install fastapi sqlalchemy psycopg2-binary uvicorn
# uvicorn fastapi_example:app --reload
# Yêu cầu SQLAlchemy >= 2.0 (hỗ trợ sẵn kiểu Range cho các cột range của PostgreSQL)

from datetime import date

from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine, Column, BigInteger, String
from sqlalchemy.dialects.postgresql import DATERANGE, Range
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.exc import IntegrityError

engine = create_engine("postgresql://user:pass@localhost/hotel")
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()
app = FastAPI()


class Booking(Base):
    __tablename__ = "bookings"
    id = Column(BigInteger, primary_key=True)
    room_id = Column(BigInteger, nullable=False)
    guest_name = Column(String, nullable=False)
    stay_range = Column(DATERANGE, nullable=False)


# Migration (xem DDL đầy đủ ở ../../README.md):
# CREATE EXTENSION IF NOT EXISTS btree_gist;
# ALTER TABLE bookings ADD CONSTRAINT no_overlap
#   EXCLUDE USING gist (room_id WITH =, stay_range WITH &&);


@app.post("/bookings")
def create_booking(room_id: int, guest_name: str, check_in: date, check_out: date):
    db: Session = SessionLocal()
    try:
        db.add(Booking(
            room_id=room_id,
            guest_name=guest_name,
            stay_range=Range(check_in, check_out, bounds="[)"),
        ))
        db.commit()
        return {"status": "booked"}
    except IntegrityError:
        db.rollback()
        # vi phạm EXCLUDE constraint: phòng đã được đặt trong khoảng ngày trùng
        raise HTTPException(409, "Phòng đã được đặt trong khoảng ngày này")
    finally:
        db.close()
