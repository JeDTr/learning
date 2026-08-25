import { useEffect, useState } from "react";
import { categories, search, seedArticles, simulateTraffic, type CategoryCount, type SearchResponse } from "../api";
import { logError } from "../logger";

export default function SearchTab() {
  const [q, setQ] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cats, setCats] = useState<CategoryCount[]>([]);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [simulating, setSimulating] = useState(false);

  async function loadCategories() {
    setCats(await categories());
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function runSearch() {
    if (!q.trim()) {
      setData(null);
      return;
    }
    setData(await search(q.trim(), activeCategory));
  }

  useEffect(() => {
    if (q.trim()) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  async function onSeed() {
    setSeeding(true);
    try {
      const res = await seedArticles();
      alert(`Đã seed ${res.seeded} bài viết.`);
      await loadCategories();
    } finally {
      setSeeding(false);
    }
  }

  async function onSimulate() {
    setSimulating(true);
    try {
      const res = await simulateTraffic(50);
      alert(`Đã ghi ${res.simulated} log giả lập vào index "demo_logs" — xem trong Kibana Discover.`);
    } finally {
      setSimulating(false);
    }
  }

  function onTestFrontendError() {
    logError("Lỗi frontend thử nghiệm (bấm nút, không phải lỗi thật)", new Error("demo error"));
    alert('Đã gửi 1 log lỗi mẫu vào index "demo_frontend_logs" — xem trong Kibana Discover.');
  }

  return (
    <>
      <div className="card">
        <div className="row">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Tìm theo từ khóa... (thử: 'elasticsearch', 'may tinh', hoặc gõ sai chút cũng được)"
          />
          <button onClick={runSearch}>Tìm kiếm</button>
          <button className="secondary" onClick={onSeed} disabled={seeding}>
            {seeding ? "Đang seed..." : "Seed lại dữ liệu mẫu"}
          </button>
          <button className="secondary" onClick={onSimulate} disabled={simulating}>
            {simulating ? "Đang ghi log..." : "Giả lập traffic (cho Kibana)"}
          </button>
          <button className="secondary" onClick={onTestFrontendError}>
            Test lỗi frontend (cho Kibana)
          </button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          {cats.map((c) => (
            <span
              key={c.category}
              className={`chip ${activeCategory === c.category ? "active" : ""}`}
              onClick={() => setActiveCategory(activeCategory === c.category ? null : c.category)}
            >
              {c.category} ({c.count})
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        {data && (
          <div className="muted" style={{ marginBottom: 8 }}>
            {data.total} kết quả cho "{q}"
            {activeCategory ? ` trong ${activeCategory}` : ""}
          </div>
        )}

        {!data && <div className="empty">Nhập từ khóa để tìm kiếm.</div>}
        {data && data.results.length === 0 && <div className="empty">Không tìm thấy kết quả.</div>}

        {data?.results.map((r) => (
          <div className="result" key={r.id}>
            <h3 dangerouslySetInnerHTML={{ __html: r.title }} />
            <p dangerouslySetInnerHTML={{ __html: r.snippet + "..." }} />
            <span className="badge">{r.category}</span>
            {r.tags.map((t) => (
              <span className="badge" key={t}>
                #{t}
              </span>
            ))}
            <span className="badge">score {r.score.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
