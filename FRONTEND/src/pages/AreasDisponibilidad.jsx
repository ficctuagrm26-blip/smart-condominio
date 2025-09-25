// src/pages/AreasDisponibilidad.jsx
// CU16: Consultar disponibilidad con calendario diario a color
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listAreas, getDisponibilidad, listReservasByArea } from "../api/areas";

/* ========= Helpers de fecha/hora ========= */
const pad2 = (n) => String(n).padStart(2, "0");
function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toLocalISOString(d) {
  const tz = d.getTimezoneOffset();
  const z = new Date(d.getTime() - tz * 60000);
  return z.toISOString().slice(0, 19); // "YYYY-MM-DDTHH:MM:SS"
}
function parseISO(s) {
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function inInterval(t, start, end) {
  return t >= start && t < end;
}
function overlaps(a1, a2, b1, b2) {
  return a1 < b2 && b1 < a2;
}
/** Construye un Date en la zona local a partir de YYYY-MM-DD y HH:MM */
function atLocal(dateStr, hhmm) {
  const [hh, mm] = hhmm.split(":").map(Number);
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d;
}

/* ========= Calendario (vista diaria) =========
   - Mostramos el día elegido en una grilla horaria (por defecto 06:00–22:00)
   - Verde: slot disponible (dentro de 'resp.slots')
   - Rojo: ocupado (intersección con reservas)
   - Gris: fuera de ventanas ('resp.windows')
*/
const DEFAULT_START = "06:00";
const DEFAULT_END = "22:00";
const STEP_MINUTES = 30; // resolución visual de calendario

export default function AreasDisponibilidad() {
  const navigate = useNavigate();

  // Filtros / formulario
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState("");
  const [date, setDate] = useState(() => ymd(new Date()));
  const [slot, setSlot] = useState(60);
  const [fromH, setFromH] = useState("");
  const [toH, setToH] = useState("");

  // Datos backend
  const [disp, setDisp] = useState(null); // disponibilidad
  const [reservas, setReservas] = useState([]); // reservas del día
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Carga inicial de áreas
  useEffect(() => {
    (async () => {
      try {
        const arr = await listAreas();
        setAreas(arr);
        if (arr.length && !areaId) setAreaId(arr[0].id);
      } catch {
        // noop
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canQuery = useMemo(() => !!areaId && !!date, [areaId, date]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canQuery) return;
    setLoading(true);
    setError("");
    setDisp(null);
    setReservas([]);
    try {
      const params = { date, slot: Number(slot) || 60 };
      if (fromH && toH) {
        params.from = fromH;
        params.to = toH;
      }
      const data = await getDisponibilidad(areaId, params);
      setDisp(data);

      // Rango día completo para pintar reservas
      const dayStart = date + "T00:00:00";
      const dayEnd = date + "T23:59:59";
      const rs = await listReservasByArea(areaId, {
        date_from: dayStart,
        date_to: dayEnd,
      });
      setReservas(rs || []);
    } catch (e2) {
      setError(
        e2?.response?.data?.detail || "Error al consultar disponibilidad."
      );
    } finally {
      setLoading(false);
    }
  };

  // Construir grilla del calendario
  const calendarRows = useMemo(() => {
    if (!disp) return [];
    const startHHMM = fromH || (disp.windows?.[0]?.start ?? DEFAULT_START);
    const endHHMM = toH || (disp.windows?.slice(-1)?.[0]?.end ?? DEFAULT_END);

    const start = atLocal(date, startHHMM);
    const end = atLocal(date, endHHMM);
    const rows = [];

    // Preprocesar: ventanas (HH:MM) -> intervalos Date
    const windows = (disp.windows || []).map((w) => ({
      start: atLocal(date, String(w.start).slice(0, 5)),
      end: atLocal(date, String(w.end).slice(0, 5)),
    }));

    // Disponibles (slots ISO) -> intervalos Date
    const disponibles = (disp.slots || [])
      .map((s) => ({
        start: parseISO(s.start),
        end: parseISO(s.end),
      }))
      .filter((s) => s.start && s.end);

    // Reservas (ISO) -> intervalos Date
    const resInts = (reservas || [])
      .map((r) => ({
        start: parseISO(r.fecha_inicio || r.start || r.begin || r.desde),
        end: parseISO(r.fecha_fin || r.end || r.hasta),
      }))
      .filter((r) => r.start && r.end);

    for (
      let t = new Date(start);
      t < end;
      t = new Date(t.getTime() + STEP_MINUTES * 60000)
    ) {
      const t2 = new Date(t.getTime() + STEP_MINUTES * 60000);

      // Está dentro de alguna ventana?
      const inWin = windows.some((w) => overlaps(t, t2, w.start, w.end));

      // Está ocupado por una reserva?
      const isBusy =
        inWin && resInts.some((r) => overlaps(t, t2, r.start, r.end));

      // Está disponible (encaja dentro de algún slot)?
      const isFree =
        inWin &&
        !isBusy &&
        disponibles.some((s) => t >= s.start && t2 <= s.end);

      rows.push({
        label: `${pad2(t.getHours())}:${pad2(t.getMinutes())}`,
        inWin,
        isBusy,
        isFree,
        start: new Date(t),
        end: new Date(t2),
      });
    }
    return rows;
  }, [disp, reservas, date, fromH, toH]);

  const goReservar = (cell) => {
    // Navega a CU17 con el rango de la celda (usuario luego puede ajustar)
    const query = new URLSearchParams({
      areaId,
      start: toLocalISOString(cell.start),
      end: toLocalISOString(cell.end),
      date,
    }).toString();
    navigate(`/areas/reservar?${query}`);
  };

  return (
    <div className="card" style={{ maxWidth: 1100 }}>
      <h2 style={{ marginBottom: 12 }}>
        Consultar disponibilidad de área común
      </h2>

      {/* Filtro / formulario */}
      <form
        className="au-form"
        onSubmit={onSubmit}
        style={{ marginBottom: 16 }}
      >
        <div
          className="au-form__grid"
          style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
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
            <label className="au-label">Fecha</label>
            <input
              className="au-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="au-field">
            <label className="au-label">Tamaño de slot (min)</label>
            <input
              className="au-input"
              type="number"
              min="15"
              step="15"
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
            />
          </div>

          <div className="au-field">
            <label className="au-label">Desde (opcional)</label>
            <input
              className="au-input"
              type="time"
              value={fromH}
              onChange={(e) => setFromH(e.target.value)}
              placeholder="HH:MM"
            />
          </div>

          <div className="au-field">
            <label className="au-label">Hasta (opcional)</label>
            <input
              className="au-input"
              type="time"
              value={toH}
              onChange={(e) => setToH(e.target.value)}
              placeholder="HH:MM"
            />
          </div>

          <div className="au-field" style={{ alignSelf: "end" }}>
            <button
              className="au-button"
              type="submit"
              disabled={!canQuery || loading}
            >
              {loading ? "Consultando..." : "Consultar"}
            </button>
          </div>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {/* Resumen de ventanas */}
      {disp && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 8 }}>
            Ventanas para {disp.date} (slot: {disp.slot_minutes} min)
          </h3>
          {!disp.windows || disp.windows.length === 0 ? (
            <p>No hay reglas configuradas para este día.</p>
          ) : (
            <ul>
              {disp.windows.map((w, i) => (
                <li key={i}>
                  {String(w.start).slice(0, 5)} - {String(w.end).slice(0, 5)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Calendario diario a color */}
      {disp && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Calendario (vista diaria)</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: 8,
            }}
          >
            {/* Columna tiempos */}
            <div style={{ display: "grid", gap: 6 }}>
              {calendarRows.map((r, idx) => (
                <div
                  key={idx}
                  style={{ textAlign: "right", paddingRight: 8, fontSize: 12 }}
                >
                  {r.label}
                </div>
              ))}
            </div>

            {/* Columna celdas */}
            <div style={{ display: "grid", gap: 6 }}>
              {calendarRows.map((r, idx) => {
                let bg = "#eceff1"; // fuera de ventanas -> gris claro
                let border = "1px solid #cfd8dc";
                let clickable = false;
                if (r.inWin) {
                  if (r.isBusy) {
                    bg = "#ffebee"; // rojo claro = ocupado
                    border = "1px solid #ef9a9a";
                  } else if (r.isFree) {
                    bg = "#e8f5e9"; // verde claro = disponible
                    border = "1px solid #a5d6a7";
                    clickable = true;
                  } else {
                    bg = "#fffde7"; // amarillo pálido = en ventana pero no cabe en slot
                    border = "1px solid #ffe082";
                  }
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => clickable && goReservar(r)}
                    disabled={!clickable}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      background: bg,
                      border,
                      borderRadius: 6,
                      cursor: clickable ? "pointer" : "default",
                    }}
                    title={
                      r.isFree
                        ? "Reservar este tramo"
                        : r.isBusy
                        ? "Ocupado"
                        : r.inWin
                        ? "No disponible al tamaño de slot"
                        : "Fuera de horario"
                    }
                  >
                    {r.isFree
                      ? "Disponible"
                      : r.isBusy
                      ? "Ocupado"
                      : r.inWin
                      ? "No disponible"
                      : "Fuera de horario"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leyenda */}
          <div
            style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 12 }}
          >
            <Legend color="#e8f5e9" border="#a5d6a7" text="Disponible" />
            <Legend color="#ffebee" border="#ef9a9a" text="Ocupado" />
            <Legend
              color="#fffde7"
              border="#ffe082"
              text="En horario, no calza con slot"
            />
            <Legend color="#eceff1" border="#cfd8dc" text="Fuera de horario" />
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, border, text }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 14,
          height: 14,
          background: color,
          border: `1px solid ${border}`,
          borderRadius: 3,
        }}
      />
      {text}
    </span>
  );
}
