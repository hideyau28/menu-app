export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        Trip Utility
      </h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/expenses" style={{ padding: 12, border: "1px solid #ccc", borderRadius: 12 }}>
          Expenses
        </a>
        <a href="/weather" style={{ padding: 12, border: "1px solid #ccc", borderRadius: 12 }}>
          Weather
        </a>
        <a href="/currency" style={{ padding: 12, border: "1px solid #ccc", borderRadius: 12 }}>
          Currency
        </a>
        <a href="/translate" style={{ padding: 12, border: "1px solid #ccc", borderRadius: 12 }}>
          Translate
        </a>
      </div>
    </main>
  );
}
