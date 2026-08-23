"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await login(String(form.get("email")), String(form.get("name")));
      router.push("/cart");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Đăng nhập</h1>
      <p style={{ color: "#6b7280", maxWidth: 480 }}>
        Demo dùng đăng nhập giả lập — chỉ cần email, không cần mật khẩu (không phải ví dụ về auth an toàn).
        Giỏ hàng ẩn danh hiện tại của bạn (nếu có sản phẩm) sẽ được gộp vào tài khoản này.
      </p>
      <form className="checkout-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input name="email" type="email" required placeholder="ban@example.com" />
        </label>
        <label>
          Tên hiển thị
          <input name="name" required placeholder="Trần Văn A" />
        </label>
        {error && <div className="error-banner">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
