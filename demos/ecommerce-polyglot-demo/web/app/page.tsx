import ProductCard from "@/components/ProductCard";
import { apiFetch } from "@/lib/api";
import type { Product } from "@/types";

export default async function HomePage() {
  const products = await apiFetch<Product[]>("/api/products");

  return (
    <div>
      <h1>Sản phẩm</h1>
      <p style={{ color: "#6b7280" }}>
        Danh sách sản phẩm được lấy từ MongoDB qua FastAPI.
      </p>
      <div className="grid">
        {products.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </div>
  );
}
