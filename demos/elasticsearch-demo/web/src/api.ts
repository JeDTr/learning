// Mọi request gọi path tương đối "/api/..." — dev server (Vite) và production
// (nginx) đều proxy "/api" sang service FastAPI, nên không cần biết base URL.
//
// Không có hàm đọc log/stats/cluster health ở đây: dashboard/monitoring là
// việc của Kibana (Discover, Dashboards), app này chỉ SINH dữ liệu (search +
// log) chứ không tự vẽ lại dashboard.

export interface SearchResult {
  id: string;
  score: number;
  title: string;
  snippet: string;
  category: string;
  tags: string[];
  published_at: string;
}

export interface SearchResponse {
  total: number;
  page: number;
  size: number;
  results: SearchResult[];
}

export interface CategoryCount {
  category: string;
  count: number;
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function search(q: string, category: string | null): Promise<SearchResponse> {
  const params = new URLSearchParams({ q });
  if (category) params.set("category", category);
  return getJSON(`/api/search?${params.toString()}`);
}

export function categories(): Promise<CategoryCount[]> {
  return getJSON("/api/search/categories");
}

export async function seedArticles(): Promise<{ seeded: number }> {
  const res = await fetch("/api/search/seed", { method: "POST" });
  if (!res.ok) throw new Error(`seed -> HTTP ${res.status}`);
  return res.json();
}

export async function simulateTraffic(count = 50): Promise<{ simulated: number }> {
  const res = await fetch(`/api/monitoring/simulate?count=${count}`, { method: "POST" });
  if (!res.ok) throw new Error(`simulate -> HTTP ${res.status}`);
  return res.json();
}
