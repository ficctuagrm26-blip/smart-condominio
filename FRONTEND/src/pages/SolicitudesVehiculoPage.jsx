// src/pages/SolicitudesVehiculoPage.jsx
import { useEffect, useState } from "react";
import {
  listSolicitudesVehiculo,
  reviewSolicitudVehiculo,
} from "../api/vehiculos";
import { listUnidades } from "../api/unidades";
import "./SolicitudesVehiculoPage.css";

const ESTADOS = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "APROBADA", label: "Aprobada" },
  { value: "RECHAZADA", label: "Rechazada" },
  { value: "CANCELADA", label: "Cancelada" },
];

export default function SolicitudesVehiculoPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [estado, setEstado] = useState("PENDIENTE");
  const [q, setQ] = useState("");
  const [unidades, setUnidades] = useState([]);
  const [unidadSel, setUnidadSel] = useState("");
  const [observ, setObserv] = useState("");
  const [selId, setSelId] = useState(null);
  const [accion, setAccion] = useState(""); // 'aprobar' | 'rechazar'
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = { estado, q };
      const data = await listSolicitudesVehiculo(params);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [estado]);

  useEffect(() => {
    listUnidades({ page_size: 9999 })
      .then(setUnidades)
      .catch(() => {});
  }, []);

  function openAction(id, kind) {
    setSelId(id);
    setAccion(kind);
    setObserv("");
    setUnidadSel("");
  }
  async function doAction() {
    if (!selId || !accion) return;
    setBusy(true);
    try {
      await reviewSolicitudVehiculo(selId, {
        accion,
        observaciones: observ,
        unidad: unidadSel || null,
      });
      setSelId(null);
      await load();
    } catch (e) {
      const msg = e?.response?.data || e?.message || "Error";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sol-vehiculos-page">
      <div className="au-toolbar">
        <form
          className="au-toolbar__form"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <div className="au-field">
            <label className="au-label">Estado</label>
            <select
              className="au-input"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              {ESTADOS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="au-field">
            <label className="au-label">Buscar</label>
            <input
              className="au-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Placa, solicitante..."
            />
          </div>
          <button className="au-button">Buscar</button>
        </form>
      </div>

      <div className="card">
        <h2 className="card__title">Solicitudes de vehículo (CU25/CU26)</h2>
        {loading ? (
          <p>Cargando...</p>
        ) : rows.length === 0 ? (
          <p>No hay registros.</p>
        ) : (
          <table className="au-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Solcitante</th>
                <th>Unidad</th>
                <th>Placa</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Adjuntos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.solicitante_nombre || r.solicitante || "-"}</td>
                  <td>{r.unidad || "-"}</td>
                  <td>{r.placa}</td>
                  <td>{r.marca || "-"}</td>
                  <td>{r.modelo || "-"}</td>
                  <td>{r.tipo}</td>
                  <td>{r.estado}</td>
                  <td>
                    <div className="files">
                      {r.foto_placa ? (
                        <a href={r.foto_placa} target="_blank" rel="noreferrer">
                          Foto placa
                        </a>
                      ) : null}
                      {r.documento ? (
                        <a href={r.documento} target="_blank" rel="noreferrer">
                          Documento
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    {r.estado === "PENDIENTE" ? (
                      <div className="row-actions">
                        <button
                          className="au-button"
                          onClick={() => openAction(r.id, "aprobar")}
                        >
                          Aprobar
                        </button>
                        <button
                          className="au-button au-button--ghost"
                          onClick={() => openAction(r.id, "rechazar")}
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selId && (
        <div className="modal">
          <div className="modal__card">
            <h3>
              {accion === "aprobar"
                ? "Aprobar solicitud"
                : "Rechazar solicitud"}
            </h3>
            <div className="au-field">
              <label className="au-label">Observaciones</label>
              <textarea
                className="au-input"
                rows="3"
                value={observ}
                onChange={(e) => setObserv(e.target.value)}
              />
            </div>
            {accion === "aprobar" && (
              <div className="au-field">
                <label className="au-label">Unidad (opcional)</label>
                <select
                  className="au-input"
                  value={unidadSel}
                  onChange={(e) => setUnidadSel(e.target.value)}
                >
                  <option value="">(usar la de la solicitud)</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.codigo || u.nombre || `Unidad ${u.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="modal__actions">
              <button className="au-button" onClick={doAction} disabled={busy}>
                {busy ? "Procesando..." : "Confirmar"}
              </button>
              <button
                className="au-button au-button--ghost"
                onClick={() => setSelId(null)}
                disabled={busy}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
