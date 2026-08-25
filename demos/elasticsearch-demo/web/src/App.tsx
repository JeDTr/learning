import SearchTab from "./components/SearchTab";

export default function App() {
  return (
    <>
      <header>
        <h1>🔎 Elasticsearch Demo</h1>
        <p>Full-text search — kết nối trực tiếp tới Elastic Cloud</p>
      </header>

      <main>
        <SearchTab />
      </main>
    </>
  );
}
