// src/pages/MisTareasPage.jsx
import { useEffect, useState } from "react";
import { listTasks, changeTaskState, takeTask } from "../api/tareas";
import TareaModal from "./modals/TareaModal";

const ESTADOS = [
  "NUEVA",
  "ASIGNADA",
  "EN_PROGRESO",
  "BLOQUEADA",
  "COMPLETADA",
  "CANCELADA",
];

export default function MisTareasPage() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const items = await listTasks({
        search: q || undefined,
        estado: estado || undefined,
        ordering: "-updated_at",
      });
      setData(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  return (
    <div>
      <h2>Mis tareas</h2>

      <div className="card au-toolbar">
        <form
          className="au-toolbar__form"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <div className="au-field">
            <label className="au-label">Buscar</label>
            <input
              className="au-input"
              placeholder="título, descripción…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="au-field" style={{ minWidth: 160 }}>
            <label className="au-label">Estado</label>
            <select
              className="au-input"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="">(todos)</option>
              {ESTADOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <button className="au-button">Buscar</button>
          <button
            type="button"
            className="au-button au-button--ghost"
            onClick={() => {
              setQ("");
              setEstado("");
              load();
            }}
          >
            Limpiar
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 12, overflowX: "auto" }}>
        <table className="au-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Estado</th>
              <th>Vence</th>
              <th>Unidad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>Cargando…</td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={6}>Sin resultados.</td>
              </tr>
            )}
            {data.map((it) => (
              <tr key={it.id}>
                <td>{it.id}</td>
                <td>{it.titulo}</td>
                <td style={{ minWidth: 180 }}>
                  <select
                    className="au-input"
                    value={it.estado}
                    onChange={(e) =>
                      changeTaskState(it.id, e.target.value).then(load)
                    }
                  >
                    {ESTADOS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{it.fecha_limite || "—"}</td>
                <td>
                  {it.unidad
                    ? `${it.unidad.torre}${
                        it.unidad.bloque ? "-" + it.unidad.bloque : ""
                      }-${it.unidad.numero}`
                    : "—"}
                </td>
                <td className="au-actions">
                  <button
                    className="au-button au-button--ghost"
                    onClick={() => setDetailId(it.id)}
                  >
                    Ver
                  </button>
                  {it.asignado_a_rol && !it.asignado_a && (
                    <button
                      className="au-button au-button--ghost"
                      onClick={() => takeTask(it.id).then(load)}
                    >
                      Tomar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TareaModal
        open={!!detailId}
        tareaId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
