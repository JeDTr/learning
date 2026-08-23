import { notFound } from "next/navigation";
import Link from "next/link";
import { apiBase } from "@/lib/api";
import type { Order } from "@/types";

async function getOrder(id: string): Promise<Order | null> {
  const res = await fetch(`${apiBase()}/api/orders/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default async function OrderPage({ params }: { params: { id: string } }) {
  const order = await getOrder(params.id);
  if (!order) notFound();

  return (
    <div>
      <h1>Đơn hàng #{order.id.slice(0, 8)}</h1>
      <span className={`badge ${order.status}`}>
        {order.status === "paid" ? "Đã thanh toán" : order.status === "failed" ? "Thất bại" : "Đang xử lý"}
      </span>

      <div className="cart-summary" style={{ marginTop: 20, flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
        <p><strong>Khách hàng:</strong> {order.customer_name} ({order.customer_email})</p>
        <p><strong>Địa chỉ giao hàng:</strong> {order.shipping_address}</p>
        {order.payment && (
          <p>
            <strong>Thanh toán:</strong> thẻ ****{order.payment.card_last4} —{" "}
            {order.payment.status === "success" ? "thành công" : "thất bại"}
          </p>
        )}
      </div>

      <h2 style={{ marginTop: 24 }}>Sản phẩm</h2>
      {order.items.map((item) => (
        <div className="cart-row" key={item.product_id}>
          <div className="info">
            <strong>{item.product_name}</strong>
            <div style={{ color: "#6b7280" }}>
              ${item.unit_price.toFixed(2)} × {item.quantity}
            </div>
          </div>
          <strong>${(item.unit_price * item.quantity).toFixed(2)}</strong>
        </div>
      ))}

      <div className="cart-summary">
        <span>
          Tổng cộng: <strong>${order.total_amount.toFixed(2)}</strong>
        </span>
      </div>

      {order.status === "failed" && (
        <p className="error-banner" style={{ marginTop: 16 }}>
          Thanh toán thất bại. Giỏ hàng của bạn vẫn được giữ nguyên, vui lòng thử lại với thẻ khác.
        </p>
      )}

      <Link href="/" className="btn" style={{ display: "inline-block", marginTop: 20 }}>
        <button>Tiếp tục mua sắm</button>
      </Link>
    </div>
  );
}
