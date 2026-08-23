"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiBase } from "@/lib/api";
import { cartHeaders } from "@/lib/session";

export default function AddToCartButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/api/cart/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cartHeaders() },
        body: JSON.stringify({ product_id: productId, quantity }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push("/cart");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className="secondary"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
        >
          −
        </button>
        <span>{quantity}</span>
        <button type="button" className="secondary" onClick={() => setQuantity((q) => q + 1)}>
          +
        </button>
      </div>
      <button type="button" onClick={handleAdd} disabled={loading}>
        {loading ? "Đang thêm..." : "Thêm vào giỏ hàng"}
      </button>
      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}
