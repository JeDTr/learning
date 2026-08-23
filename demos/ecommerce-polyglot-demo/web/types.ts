export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  stock: number;
}

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  subtotal: number;
}

export interface Cart {
  cart_id: string;
  items: CartItem[];
  total: number;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export interface Payment {
  status: "success" | "failed";
  method: string;
  card_last4: string;
  created_at: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  status: "pending" | "paid" | "failed";
  total_amount: number;
  created_at: string;
  items: OrderItem[];
  payment: Payment | null;
}
