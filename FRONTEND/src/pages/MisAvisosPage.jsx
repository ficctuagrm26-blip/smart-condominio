// src/pages/MisAvisosPage.jsx
import { useEffect, useState } from "react";
import { listAvisos } from "../api/avisos";
import AvisoModal from "./modals/AvisoModal";

export default function MisAvisosPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listAvisos(
        q ? { search: q, ordering: "-publish_at" } : { ordering: "-publish_at" }
      );
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openModal = (aviso) => {
    setSelected(aviso);
    setOpen(true);
  };
  const closeModal = () => {
    setOpen(false);
    setSelected(null);
  };

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Mis avisos</h2>

      <div className="card au-toolbar">
        <form
          className="au-toolbar__form"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <div className="au-field">
            <label className="au-label">Búsqueda</label>
            <input
              className="au-input"
              placeholder="título, cuerpo..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="au-button">Buscar</button>
          <button
            type="button"
            className="au-button au-button--ghost"
            onClick={() => {
              setQ("");
              load();
            }}
          >
            Limpiar
          </button>
        </form>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="au-table" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Título</th>
              <th>Detalle</th>
              <th>Adjuntos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5}>Cargando…</td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5}>No hay avisos disponibles.</td>
              </tr>
            )}

            {!loading &&
              items.length > 0 &&
              items.map((it) => (
                <tr
                  key={it.id}
                  onDoubleClick={() => openModal(it)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    {it.publish_at
                      ? new Date(it.publish_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>{it.titulo}</td>
                  <td style={{ maxWidth: 500 }}>
                    <div style={{ whiteSpace: "pre-wrap" }}>
                      {it.cuerpo?.length > 140
                        ? it.cuerpo.slice(0, 140) + "…"
                        : it.cuerpo}
                    </div>
                  </td>
                  <td>
                    {(it.adjuntos || []).length > 0 ? (
                      (it.adjuntos || []).map((u, i) => (
                        <div key={i}>
                          <a href={u} target="_blank" rel="noreferrer">
                            Adjunto {i + 1}
                          </a>
                        </div>
                      ))
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="au-button au-button--ghost"
                      onClick={() => openModal(it)}
                    >
                      Leer
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Modal de lectura */}
      <AvisoModal open={open} onClose={closeModal} aviso={selected} />
    </div>
  );
}
