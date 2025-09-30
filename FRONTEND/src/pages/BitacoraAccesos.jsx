// src/pages/BitacoraAccesos.jsx
import { useEffect, useState } from "react";
import { listAccessEvents, exportAccessCSV } from "../api/accesscars";
import "./BitacoraAccesos.css"; // ⬅️ agrega estilos de chips aquí

export default function BitacoraAccesos() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState({
    from: "",
    to: "",
    plate: "",
    camera_id: "",
    decision: "",
    direction: "",
    opened: "",
    min_score: "",
  });

  async function load() {
    setLoading(true);
    try {
      const data = await listAccessEvents(q);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card">
      <h2 className="card__title">Bitácora de accesos (OCR)</h2>

      <div className="au-grid-7">
        <input
          className="au-input"
          placeholder="Desde (YYYY-MM-DD)"
          value={q.from}
          onChange={(e) => setQ({ ...q, from: e.target.value })}
        />
        <input
          className="au-input"
          placeholder="Hasta (YYYY-MM-DD)"
          value={q.to}
          onChange={(e) => setQ({ ...q, to: e.target.value })}
        />
        <input
          className="au-input"
          placeholder="Placa"
          value={q.plate}
          onChange={(e) => setQ({ ...q, plate: e.target.value })}
        />
        <input
          className="au-input"
          placeholder="Cámara"
          value={q.camera_id}
          onChange={(e) => setQ({ ...q, camera_id: e.target.value })}
        />
        <select
          className="au-input"
          value={q.decision}
          onChange={(e) => setQ({ ...q, decision: e.target.value })}
        >
          <option value="">(todas decisiones)</option>
          <option>ALLOW_RESIDENT</option>
          <option>ALLOW_VISIT</option>
          <option>DENY_UNKNOWN</option>
          <option>ERROR_OCR</option>
        </select>
        <select
          className="au-input"
          value={q.direction}
          onChange={(e) => setQ({ ...q, direction: e.target.value })}
        >
          <option value="">(todas direcciones)</option>
          <option value="ENTRADA">ENTRADA</option>
          <option value="SALIDA">SALIDA</option>
        </select>
        <select
          className="au-input"
          value={q.opened}
          onChange={(e) => setQ({ ...q, opened: e.target.value })}
        >
          <option value="">(abrió o no)</option>
          <option value="true">Sí abrió</option>
          <option value="false">No abrió</option>
        </select>
      </div>

      <div className="au-grid-2" style={{ marginTop: "0.5rem" }}>
        <input
          className="au-input"
          placeholder="Score mínimo"
          value={q.min_score}
          onChange={(e) => setQ({ ...q, min_score: e.target.value })}
        />
      </div>

      <div className="au-toolbar">
        <button className="au-button" onClick={load}>
          Filtrar
        </button>
        <button
          className="au-button au-button--ghost"
          onClick={() => exportAccessCSV(q)}
        >
          Exportar CSV
        </button>
      </div>

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <table className="au-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cam</th>
              <th>Dirección</th>
              <th>Placa</th>
              <th>Score</th>
              <th>Decisión</th>
              <th>Abrió</th>
              <th>Vehículo</th>
              <th>Visita</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.camera_id || "-"}</td>
                <td>
                  {r.direction ? (
                    <span
                      className={`chip chip--${
                        r.direction === "ENTRADA" ? "entrada" : "salida"
                      }`}
                    >
                      {r.direction}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td>{r.plate_norm || r.plate_raw || "-"}</td>
                <td>{r.score ?? "-"}</td>
                <td>{r.decision}</td>
                <td>{r.opened ? "Sí" : "No"}</td>
                <td>{r.vehicle ?? "-"}</td>
                <td>{r.visit ?? "-"}</td>
                <td>{r.reason || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
