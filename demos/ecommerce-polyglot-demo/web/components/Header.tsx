"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearStoredUser, getStoredUser, onUserChanged, type StoredUser } from "@/lib/session";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
    return onUserChanged(() => setUser(getStoredUser()));
  }, []);

  function handleLogout() {
    clearStoredUser();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        🛒 Polyglot Shop
      </Link>
      <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Link href="/">Sản phẩm</Link>
        <Link href="/cart">Giỏ hàng</Link>
        {user ? (
          <>
            <span style={{ color: "#e5e7eb" }}>Xin chào, {user.name}</span>
            <button type="button" className="secondary" onClick={handleLogout}>
              Đăng xuất
            </button>
          </>
        ) : (
          <Link href="/login">Đăng nhập</Link>
        )}
      </nav>
    </header>
  );
}
