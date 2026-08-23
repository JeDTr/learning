"""Mock cong thanh toan.

Khong goi ra ngoai that - chi mo phong de demo luong pending -> paid/failed.
Quy uoc de test: the ket thuc bang "0000" se bi tu choi, con lai deu thanh cong.
"""

from app.models.schemas import PaymentIn


def process_payment(payment: PaymentIn) -> tuple[str, str]:
    last4 = payment.card_number[-4:]
    status = "failed" if last4 == "0000" else "success"
    return status, last4
