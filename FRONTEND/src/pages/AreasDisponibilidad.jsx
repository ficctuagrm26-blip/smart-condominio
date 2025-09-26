// src/pages/AreasDisponibilidad.jsx
// CU16 — Vista MENSUAL simple: elegir área y navegar meses para ver disponibilidad.

import { useEffect, useMemo, useState } from "react";
import { listAreas, getDisponibilidad } from "../api/areas";

/* ===== Helpers ===== */
const pad2 = (n) => String(n).padStart(2, "0");
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const DEFAULT_SLOT = 60;

function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function ym(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

/* Secuencial para no saturar el backend */
async function mapSeries(arr, fn) {
  const out = [];
  for (const x of arr) out.push(await fn(x));
  return out;
}

export default function AreasDisponibilidad() {
  // filtros
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState("");

  // mes actual
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const monthLabel = useMemo(
    () =>
      monthDate.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [monthDate]
  );

  // dataset mensual
  const [monthData, setMonthData] = useState([]); // [{dateStr, status}]
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // cargar áreas
  useEffect(() => {
    (async () => {
      try {
        const arr = await listAreas();
        setAreas(arr);
        if (arr.length && !areaId) setAreaId(arr[0].id);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cargar disponibilidad mensual al cambiar área o mes
  useEffect(() => {
    if (!areaId) return;
    (async () => {
      setLoading(true);
      setErr("");
      setMonthData([]);
      try {
        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);
        const days = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          days.push(ymd(d));
        }
        // status por día:
        //  - "free" (verde): hay al menos 1 slot disponible.
        //  - "full" (rojo): hay reglas ese día, pero 0 slots.
        //  - "no-rules" (gris): sin reglas para ese día.
        const results = await mapSeries(days, async (dateStr) => {
          const d = await getDisponibilidad(areaId, {
            date: dateStr,
            slot: DEFAULT_SLOT,
          });
          const windows = Array.isArray(d.windows) ? d.windows : [];
          const slots = Array.isArray(d.slots) ? d.slots : [];
          let status = "no-rules";
          if (windows.length > 0) status = slots.length > 0 ? "free" : "full";
          return { dateStr, status };
        });
        setMonthData(results);
      } catch (e) {
        setErr(
          e?.response?.data?.detail ||
            "Error al cargar la disponibilidad mensual."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [areaId, monthDate]);

  // construir grilla mensual (con huecos al inicio para que la semana empiece en Lunes)
  const monthGrid = useMemo(() => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const startWeekIndex = (start.getDay() + 6) % 7; // 0=Lunes ... 6=Domingo
    const daysInMonth = end.getDate();
    const cells = Array.from({ length: startWeekIndex }, () => null); // huecos
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = ym(monthDate) + "-" + pad2(d);
      const info = monthData.find((x) => x.dateStr === dateStr);
      cells.push({ d, dateStr, status: info?.status || "no-rules" });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthDate, monthData]);

  return (
    <div className="card" style={{ maxWidth: 1100 }}>
      <div className="card__header">
        <h2>Disponibilidad de áreas (Calendario mensual)</h2>
        <div className="calendar__nav">
          <button
            className="au-button au-button--ghost"
            onClick={() => setMonthDate(addMonths(monthDate, -1))}
          >
            ◀ Mes anterior
          </button>
          <button
            className="au-button au-button--ghost"
            onClick={() => setMonthDate(startOfMonth(new Date()))}
          >
            Hoy
          </button>
          <button
            className="au-button au-button--ghost"
            onClick={() => setMonthDate(addMonths(monthDate, 1))}
          >
            Mes siguiente ▶
          </button>
        </div>
      </div>

      {/* filtros mínimos */}
      <div className="card__section">
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
            >
              <option value="" disabled>
                Seleccione...
              </option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre ?? a.id}
                </option>
              ))}
            </select>
          </div>
          <div className="au-field">
            <label className="au-label">Mes</label>
            <input
              className="au-input"
              type="month"
              value={ym(monthDate)}
              onChange={(e) => {
                const [Y, M] = e.target.value.split("-").map(Number);
                setMonthDate(new Date(Y, (M || 1) - 1, 1));
              }}
            />
          </div>
        </div>
        {err && (
          <p className="error" style={{ marginTop: 8 }}>
            {err}
          </p>
        )}
      </div>

      {/* mes */}
      <div className="card__section">
        <div className="mini" style={{ marginBottom: 10 }}>
          <strong>{monthLabel}</strong>
        </div>

        <div className="month-grid">
          {WEEKDAYS.map((w) => (
            <div key={w} className="month-head">
              {w}
            </div>
          ))}

          {loading ? (
            <div className="month-loading">Cargando mes…</div>
          ) : (
            monthGrid.map((cell, idx) => {
              if (!cell)
                return (
                  <div key={idx} className="month-cell month-cell--empty" />
                );
              let className = "month-cell ";
              className +=
                cell.status === "free"
                  ? "is-free"
                  : cell.status === "full"
                  ? "is-full"
                  : "is-norules";
              return (
                <div key={idx} className={className} title={cell.dateStr}>
                  <span className="day">{cell.d}</span>
                  {cell.status === "free" && <span className="dot dot--free" />}
                  {cell.status === "full" && <span className="dot dot--full" />}
                  {cell.status === "no-rules" && (
                    <span className="dot dot--norules" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* leyenda */}
        <div className="mini" style={{ marginTop: 10 }}>
          <strong>Leyenda</strong>
          <div className="legend">
            <Legend color="#e8f5e9" border="#a5d6a7" text="Disponible" />
            <Legend color="#ffebee" border="#ef9a9a" text="Ocupado" />
            <Legend color="#eceff1" border="#cfd8dc" text="Sin reglas" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, border, text }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        marginRight: 12,
        marginTop: 6,
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          background: color,
          border: `1px solid ${border}`,
          borderRadius: 3,
        }}
      />
      <span style={{ fontSize: 12 }}>{text}</span>
    </span>
  );
}
