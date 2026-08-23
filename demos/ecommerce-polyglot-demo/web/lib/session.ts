const USER_KEY = "ecommerce_demo_user";
const GUEST_CART_KEY = "ecommerce_demo_cart_id";
// "storage" event chi ban sang tab khac, khong ban trong chinh tab vua thay doi -
// nen Header (doc localStorage 1 lan luc mount) se khong biet trang /login vua
// dang nhap xong neu chi dua vao localStorage. Dung custom event de bao lai.
const USER_CHANGED_EVENT = "ecommerce_demo_user_changed";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as StoredUser) : null;
}

export function setStoredUser(user: StoredUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(USER_CHANGED_EVENT));
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(USER_CHANGED_EVENT));
}

export function onUserChanged(callback: () => void): () => void {
  window.addEventListener(USER_CHANGED_EVENT, callback);
  return () => window.removeEventListener(USER_CHANGED_EVENT, callback);
}

export function getOrCreateGuestCartId(): string {
  let id = localStorage.getItem(GUEST_CART_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_CART_KEY, id);
  }
  return id;
}

// Header dung cho moi request lien quan gio hang/checkout: uu tien user da
// dang nhap (gio hang ben trong Postgres), fallback ve gio hang an danh
// (Redis, dinh danh boi cart_id luu trong localStorage).
export function cartHeaders(): Record<string, string> {
  const user = getStoredUser();
  if (user) return { "X-User-Id": user.id };
  return { "X-Cart-Id": getOrCreateGuestCartId() };
}
