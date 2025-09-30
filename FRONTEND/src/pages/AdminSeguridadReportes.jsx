// src/pages/AdminSeguridadReportes.jsx
// --------------------------------------------------------------
// Reportes de Seguridad (ADMIN)
// Consolida OCR (vehículos) + Reconocimiento Facial con gráficos
// --------------------------------------------------------------
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar,
} from "recharts";

import { listAccessEvents as listAccessCars } from "../api/accesscars";
import { listAccessEvents as listAccessFace } from "../api/face_access";

import "./AdminSeguridadReportes.css";
import KPI from "../components/security/KPI";

// ============ Utiles ============
// YYYY-MM-DD
const fmtDate = (d) => new Date(d).toISOString().slice(0, 10);

function rangeDays(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  const out = [];
  for (let dt = new Date(a); dt <= b; dt.setDate(dt.getDate() + 1)) {
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

function sumBy(arr, keyFn, valFn = () => 1) {
  const m = new Map();
  for (const it of arr) {
    const k = keyFn(it);
    m.set(k, (m.get(k) || 0) + (valFn(it) || 0));
  }
  return m;
}

function takeTop(mapOrEntries, k = 5) {
  const arr = Array.isArray(mapOrEntries)
    ? mapOrEntries
    : Array.from(mapOrEntries.entries());
  return arr
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([name, value]) => ({ name, value }));
}

const COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7f50",
  "#8dd1e1", "#a4de6c", "#d0ed57", "#ffc0cb",
];

// Normaliza un evento a un modelo común
function normalizeEvent(ev, source) {
  return {
    id: ev.id,
    date: ev.created_at,
    day: fmtDate(ev.created_at),
    decision: ev.decision || "-",
    direction: ev.direction || "-",
    opened: !!ev.opened,
    plate: ev.plate_norm || "",
    camera: ev.camera_id || "",
    score: ev.score ?? null,
    isFacial: source === "FACIAL",
    isOCR: source === "OCR",
  };
}

export default function AdminSeguridadReportes() {
  const [from, setFrom] = useState(() => fmtDate(new Date(Date.now() - 7 * 86400000))); // últimos 7 días
  const [to, setTo] = useState(() => fmtDate(new Date()));
  const [minScore, setMinScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rowsOCR, setRowsOCR] = useState([]);
  const [rowsFacial, setRowsFacial] = useState([]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [cars, faces] = await Promise.all([
        listAccessCars({ from, to }),
        listAccessFace({ from, to }),
      ]);

      const facesOnly = (faces || []).filter(
        (e) => (!e.plate_norm || e.plate_norm.trim() === "") && e.payload && e.payload.rekognition
      );

      const facesFiltered =
        (minScore > 0)
          ? facesOnly.filter((f) => (Number(f.score) || 0) >= Number(minScore))
          : facesOnly;

      setRowsOCR(cars || []);
      setRowsFacial(facesFiltered);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Normalizados
  const normOCR = useMemo(() => rowsOCR.map((r) => normalizeEvent(r, "OCR")), [rowsOCR]);
  const normFAC = useMemo(() => rowsFacial.map((r) => normalizeEvent(r, "FACIAL")), [rowsFacial]);
  const all = useMemo(() => [...normOCR, ...normFAC], [normOCR, normFAC]);

  // KPIs
  const kpis = useMemo(() => {
    const total = all.length;
    const allow = all.filter((e) => e.decision === "ALLOW_RESIDENT" || e.decision === "ALLOW_VISIT").length;
    const deny = all.filter((e) => e.decision === "DENY_UNKNOWN").length;
    const errors = all.filter((e) => e.decision === "ERROR_OCR").length;
    const opened = all.filter((e) => e.opened).length;
    const openRate = total > 0 ? Math.round((opened / total) * 100) : 0;
    const facial = normFAC.length;
    const ocr = normOCR.length;
    return { total, allow, deny, errors, opened, openRate, facial, ocr };
  }, [all, normFAC.length, normOCR.length]);

  // Serie diaria
  const days = useMemo(() => rangeDays(from, to), [from, to]);
  const perDayMap = useMemo(() => {
    const base = new Map(days.map((d) => [d, { day: d, OCR: 0, FACIAL: 0 }]));
    for (const e of normOCR) base.get(e.day).OCR++;
    for (const e of normFAC) base.get(e.day).FACIAL++;
    return Array.from(base.values());
  }, [days, normOCR, normFAC]);

  // Pie decisiones
  const decisions = useMemo(() => {
    const m = sumBy(all, (e) => e.decision);
    return takeTop(m, 10);
  }, [all]);

  // Top placas (OCR)
  const topPlates = useMemo(() => {
    const m = sumBy(normOCR.filter((e) => e.plate), (e) => e.plate);
    return takeTop(m, 7);
  }, [normOCR]);

  // Actividad por cámara
  const topCams = useMemo(() => {
    const m = sumBy(all.filter((e) => e.camera), (e) => e.camera);
    return takeTop(m, 7);
  }, [all]);

  // Entradas vs salidas
  const dirDist = useMemo(() => {
    const m = sumBy(all, (e) => e.direction || "-");
    return [
      { name: "ENTRADA", value: m.get("ENTRADA") || 0 },
      { name: "SALIDA", value: m.get("SALIDA") || 0 },
    ];
  }, [all]);

  // Anomalías
  const anomalies = useMemo(() => {
    return all
      .filter((e) => e.decision === "DENY_UNKNOWN" || e.decision === "ERROR_OCR")
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 20);
  }, [all]);

  return (
    <div className="asr-wrap">
      <div className="asr-head">
        <div>
          <h2>Reportes de Seguridad</h2>
          <div className="asr-sub">OCR (vehículos) + Reconocimiento Facial</div>
        </div>

        <div className="asr-filters">
          <input
            className="asr-input"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            className="asr-input"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <input
            className="asr-input"
            type="number"
            step="0.01"
            min={0}
            max={1}
            placeholder="Score facial mínimo"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            title="Filtra eventos FACIALES por similaridad mínima (0..1)"
          />
          <button className="asr-btn" onClick={load} disabled={loading}>
            {loading ? "Cargando…" : "Aplicar"}
          </button>
        </div>
      </div>

      {error && <div className="asr-alert">{error}</div>}

      {/* KPIs */}
      <div className="asr-kpis">
        <KPI label="Eventos" value={kpis.total} />
        <KPI label="Permitidos" value={kpis.allow} />
        <KPI label="Denegados" value={kpis.deny} />
        <KPI label="Errores" value={kpis.errors} />
        <KPI label="Aperturas" value={kpis.opened} />
        <KPI label="Open rate" value={`${kpis.openRate}%`} />
        <KPI label="Facial" value={kpis.facial} />
        <KPI label="OCR" value={kpis.ocr} />
      </div>

      {/* Serie diaria */}
      <section className="asr-section">
        <h3>Eventos por día</h3>
        <div className="asr-chart">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={perDayMap} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="OCR" stroke="#8884d8" fillOpacity={1} fill="url(#g1)" />
              <Area type="monotone" dataKey="FACIAL" stroke="#82ca9d" fillOpacity={1} fill="url(#g2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Decisiones y direcciones */}
      <section className="asr-section grid2">
        <div>
          <h3>Distribución por decisión</h3>
          <div className="asr-chart">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={decisions} dataKey="value" nameKey="name" outerRadius={100}>
                  {decisions.map((entry, index) => (
                    <Cell key={`c-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3>Entradas vs salidas</h3>
          <div className="asr-chart">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dirDist}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Top placas y cámaras */}
      <section className="asr-section grid2">
        <div>
          <h3>Top placas (OCR)</h3>
          <div className="asr-chart">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topPlates} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={50} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3>Actividad por cámara</h3>
          <div className="asr-chart">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topCams} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={50} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Anomalías recientes */}
      <section className="asr-section">
        <h3>Eventos sospechosos recientes</h3>
        <table className="asr-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Decisión</th>
              <th>Dirección</th>
              <th>Cámara</th>
              <th>Placa</th>
              <th>Score</th>
              <th>Abrió</th>
            </tr>
          </thead>
          <tbody>
            {anomalies.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.date).toLocaleString()}</td>
                <td>{a.isFacial ? "Facial" : "OCR"}</td>
                <td>{a.decision}</td>
                <td>{a.direction}</td>
                <td>{a.camera || "-"}</td>
                <td>{a.plate || "-"}</td>
                <td>{a.score == null ? "-" : Number(a.score).toFixed(2)}</td>
                <td>{a.opened ? "Sí" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
