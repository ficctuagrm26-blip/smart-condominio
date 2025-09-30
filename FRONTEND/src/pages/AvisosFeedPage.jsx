// src/pages/AvisosFeedPage.jsx
import { useEffect, useState } from "react";
import { listAvisosPublic } from "../api/avisos";
import AvisoCard from "../components/AvisoCard";
import "./AvisosFeedPage.css"; // 👈 nuevo css

export default function AvisosFeedPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listAvisosPublic(
        q ? { search: q, ordering: "-publish_at" } : { ordering: "-publish_at" }
      );
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="page avisos-feed">{/* 👈 scope de estilos */}
      <h2 className="page__title">Comunicados</h2>

      <div className="card toolbar">
        <form
          className="toolbar__form"
          onSubmit={(e) => { e.preventDefault(); load(); }}
        >
          <input
            className="input"
            placeholder="Buscar por título o contenido…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn">Buscar</button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => { setQ(""); load(); }}
          >
            Limpiar
          </button>
        </form>
      </div>

      <div className="feed">
        {loading && <div className="empty">Cargando…</div>}
        {!loading && items.length === 0 && (
          <div className="empty">No hay comunicados disponibles.</div>
        )}
        {items.map((av) => <AvisoCard key={av.id} aviso={av} />)}
      </div>
    </div>
  );
}
