import Link from "next/link";
import type { Product } from "@/types";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product._id}`} className="card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={product.image} alt={product.name} />
      <div className="body">
        <span className="category">{product.category}</span>
        <strong>{product.name}</strong>
        <span className="price">${product.price.toFixed(2)}</span>
      </div>
    </Link>
  );
}
