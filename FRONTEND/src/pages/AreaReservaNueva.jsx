// src/pages/AreaReservaNueva.jsx
// CU17: Crear / gestionar reserva (pantalla de alta)
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createReserva, listAreas } from "../api/areas";
import { api } from "../api/auth";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}
function fmtLocal(dt) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export default function AreaReservaNueva() {
  const navigate = useNavigate();
  const q = useQuery();

  const qsArea = q.get("areaId") || "";
  const qsStart = q.get("start") || "";
  const qsEnd = q.get("end") || "";

  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState(qsArea);
  const [start, setStart] = useState(qsStart);
  const [end, setEnd] = useState(qsEnd);
  const [unidadId, setUnidadId] = useState("");
  const [unidades, setUnidades] = useState([]);
  const [nota, setNota] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Cargar áreas y unidades del usuario (si aplica)
  useEffect(() => {
    (async () => {
      try {
        const arr = await listAreas();
        setAreas(arr);
        if (!qsArea && arr.length) setAreaId(arr[0].id);
      } catch {}
      try {
        const { data } = await api.get("/unidades/", {
          params: { is_active: true },
        });
        const items = Array.isArray(data) ? data : data.results || [];
        setUnidades(items);
        if (items.length) setUnidadId(String(items[0].id));
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valid = useMemo(() => {
    if (!areaId || !start || !end) return false;
    try {
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      return isFinite(s) && isFinite(e) && e > s;
    } catch {
      return false;
    }
  }, [areaId, start, end]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError("");

    const payload = {
      area: Number(areaId),
      fecha_inicio: start,
      fecha_fin: end,
      nota: nota || undefined,
    };
    if (unidadId) payload.unidad = Number(unidadId);

    try {
      await createReserva(payload);
      alert("¡Reserva creada con éxito!");
      navigate("/areas/disponibilidad", { replace: true });
    } catch (e2) {
      setError(e2?.response?.data?.detail || "No se pudo crear la reserva.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <h2 style={{ marginBottom: 12 }}>Nueva reserva de área común</h2>

      <form className="au-form" onSubmit={onSubmit}>
        <div
          className="au-form__grid"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          <div className="au-field">
            <label className="au-label">Área</label>
            <select
              className="au-input"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              required
            >
              <option value="" disabled>
                Seleccione...
              </option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="au-field">
            <label className="au-label">Unidad (opcional)</label>
            <select
              className="au-input"
              value={unidadId}
              onChange={(e) => setUnidadId(e.target.value)}
            >
              <option value="">—</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.torre}-{u.bloque}-{u.numero} (ID {u.id})
                </option>
              ))}
            </select>
          </div>

          <div className="au-field">
            <label className="au-label">Inicio</label>
            <input
              className="au-input"
              type="datetime-local"
              value={start.replace("Z", "")}
              onChange={(e) => setStart(e.target.value)}
              required
            />
            <small className="muted">
              Actual: {start ? fmtLocal(start) : "—"}
            </small>
          </div>

          <div className="au-field">
            <label className="au-label">Fin</label>
            <input
              className="au-input"
              type="datetime-local"
              value={end.replace("Z", "")}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
            <small className="muted">Actual: {end ? fmtLocal(end) : "—"}</small>
          </div>

          <div className="au-field" style={{ gridColumn: "1 / -1" }}>
            <label className="au-label">Nota (opcional)</label>
            <textarea
              className="au-input"
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Información adicional para administración"
            />
          </div>

          <div className="au-field" style={{ alignSelf: "end" }}>
            <button
              className="au-button au-button--ghost"
              type="button"
              onClick={() => navigate(-1)}
            >
              Volver
            </button>
          </div>
          <div className="au-field" style={{ alignSelf: "end" }}>
            <button
              className="au-button"
              type="submit"
              disabled={!valid || submitting}
            >
              {submitting ? "Creando..." : "Crear reserva"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <p className="error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
