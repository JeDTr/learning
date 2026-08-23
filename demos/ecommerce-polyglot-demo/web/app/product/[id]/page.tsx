import { notFound } from "next/navigation";
import AddToCartButton from "@/components/AddToCartButton";
import { apiBase } from "@/lib/api";
import type { Product } from "@/types";

async function getProduct(id: string): Promise<Product | null> {
  const res = await fetch(`${apiBase()}/api/products/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);
  if (!product) notFound();

  return (
    <div className="product-detail">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={product.image} alt={product.name} />
      <div>
        <span className="category">{product.category}</span>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <p className="price" style={{ fontSize: "1.4rem" }}>
          ${product.price.toFixed(2)}
        </p>
        <p style={{ color: "#6b7280" }}>Còn {product.stock} sản phẩm trong kho</p>
        <AddToCartButton productId={product._id} />
      </div>
    </div>
  );
}
