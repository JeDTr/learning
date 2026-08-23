"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiBase } from "@/lib/api";
import { cartHeaders } from "@/lib/session";
import type { Cart } from "@/types";

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCart() {
    try {
      const res = await fetch(`${apiBase()}/api/cart`, {
        headers: cartHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      setCart(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  }

  useEffect(() => {
    loadCart();
  }, []);

  async function removeItem(productId: string) {
    const res = await fetch(`${apiBase()}/api/cart/items/${productId}`, {
      method: "DELETE",
      headers: cartHeaders(),
    });
    if (res.ok) setCart(await res.json());
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!cart) return <p>Đang tải giỏ hàng...</p>;

  if (cart.items.length === 0) {
    return (
      <div className="empty-state">
        <p>Giỏ hàng trống.</p>
        <Link href="/" className="btn">
          Tiếp tục mua sắm
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Giỏ hàng</h1>
      {cart.items.map((item) => (
        <div className="cart-row" key={item.product_id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt={item.name} />
          <div className="info">
            <strong>{item.name}</strong>
            <div style={{ color: "#6b7280" }}>
              ${item.price.toFixed(2)} × {item.quantity}
            </div>
          </div>
          <strong>${item.subtotal.toFixed(2)}</strong>
          <button className="danger" onClick={() => removeItem(item.product_id)}>
            Xóa
          </button>
        </div>
      ))}
      <div className="cart-summary">
        <span>
          Tổng cộng: <strong>${cart.total.toFixed(2)}</strong>
        </span>
        <Link href="/checkout">
          <button>Thanh toán</button>
        </Link>
      </div>
    </div>
  );
}
