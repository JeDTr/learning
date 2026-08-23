"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiBase } from "@/lib/api";
import { cartHeaders, getStoredUser, type StoredUser } from "@/lib/session";

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      customer_name: form.get("customer_name"),
      customer_email: form.get("customer_email"),
      shipping_address: form.get("shipping_address"),
      payment: {
        card_number: form.get("card_number"),
        card_holder: form.get("card_holder"),
        expiry: form.get("expiry"),
        cvv: form.get("cvv"),
      },
    };

    try {
      const res = await fetch(`${apiBase()}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cartHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const order = await res.json();
      router.push(`/order/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Thanh toán</h1>
      {/* key theo user: bat form remount de defaultValue duoc dien lai sau khi
          doc xong localStorage o useEffect (lan render dau user con la null) */}
      <form className="checkout-form" onSubmit={handleSubmit} key={user?.id ?? "guest"}>
        <label>
          Họ tên
          <input name="customer_name" required defaultValue={user?.name ?? ""} />
        </label>
        <label>
          Email
          <input name="customer_email" type="email" required defaultValue={user?.email ?? ""} />
        </label>
        <label>
          Địa chỉ giao hàng
          <input name="shipping_address" required />
        </label>
        <hr />
        <label>
          Số thẻ
          <input
            name="card_number"
            required
            minLength={12}
            maxLength={19}
            placeholder="Kết thúc bằng 0000 để mô phỏng thanh toán thất bại"
          />
        </label>
        <label>
          Chủ thẻ
          <input name="card_holder" required />
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ flex: 1 }}>
            Hết hạn (MM/YY)
            <input name="expiry" required placeholder="12/28" />
          </label>
          <label style={{ flex: 1 }}>
            CVV
            <input name="cvv" required minLength={3} maxLength={4} />
          </label>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? "Đang xử lý..." : "Đặt hàng"}
        </button>
      </form>
    </div>
  );
}
