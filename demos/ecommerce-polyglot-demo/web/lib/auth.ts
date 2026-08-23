import { apiBase } from "@/lib/api";
import { getOrCreateGuestCartId, setStoredUser, type StoredUser } from "@/lib/session";

export async function login(email: string, name: string): Promise<StoredUser> {
  const res = await fetch(`${apiBase()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name }),
  });
  if (!res.ok) throw new Error(await res.text());
  const user = (await res.json()) as StoredUser;

  // gop gio hang an danh (neu co san pham) vao gio hang ben cua user vua dang nhap,
  // giong cach Shopee gop gio hang khach vao tai khoan luc login.
  const guestCartId = getOrCreateGuestCartId();
  await fetch(`${apiBase()}/api/cart/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": user.id },
    body: JSON.stringify({ guest_cart_id: guestCartId }),
  });

  setStoredUser(user);
  return user;
}
