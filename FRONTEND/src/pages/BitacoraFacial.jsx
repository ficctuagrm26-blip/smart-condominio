// src/pages/BitacoraFacial.jsx
import { useEffect, useMemo, useState } from "react";
import { listAccessEvents, exportAccessCSV, fetchUserById } from "../api/face_access";
import "./BitacoraFacial.css";

export default function BitacoraFacial() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState({
    from: "",
    to: "",
    camera_id: "",
    decision: "",
    direction: "",
    opened: "",
    min_score: "",
  });
  const [error, setError] = useState("");

  // pequeño cache de usuarios por id (para mostrar nombre/email)
  const [userCache, setUserCache] = useState({}); // { [id]: userObject }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await listAccessEvents(q);
      // Filtramos SOLO FACIALES: plate_norm vacío y payload.rekognition presente
      const facials = (data || []).filter(
        (e) => (!e.plate_norm || e.plate_norm.trim() === "") && e.payload && e.payload.rekognition
      );
      setRows(facials);
    } catch (e) {
      setError(
        e?.response?.data?.detail || e?.message || "No se pudo cargar la bitácora facial"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Identifica los user_ids a buscar dentro de payload
  const userIdsToFetch = useMemo(() => {
    const ids = new Set();
    rows.forEach((r) => {
      const uid = r?.payload?.matched_user_id;
      if (uid && !userCache[uid]) ids.add(uid);
    });
    return Array.from(ids);
  }, [rows, userCache]);

  // Carga datos de usuarios faltantes (mejor UX en ADMIN)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (userIdsToFetch.length === 0) return;
      const entries = {};
      for (const id of userIdsToFetch) {
        try {
          const u = await fetchUserById(id);
          entries[id] = u;
        } catch {
          // ignora faltas de permisos/errores silenciosamente
        }
      }
      if (!cancelled && Object.keys(entries).length) {
        setUserCache((prev) => ({ ...prev, ...entries }));
      }
    })();
    return () => { cancelled = true; };
  }, [userIdsToFetch]);

  function labelDecision(dec) {
    const m = {
      ALLOW_RESIDENT: "Residente",
      ALLOW_VISIT: "Visita",
      DENY_UNKNOWN: "Denegado",
      ERROR_OCR: "Error",
    };
    return m[dec] || dec || "-";
  }

  function pct(score) {
    if (score === null || score === undefined) return "-";
    return `${(Number(score) * 100).toFixed(2)}%`;
  }

  return (
    <div className="bf-card">
      <div className="bf-header">
        <h2>Bitácora Facial (Ingresos)</h2>
        <div className="bf-actions">
          <button className="bf-btn" onClick={load}>Filtrar</button>
          <button
            className="bf-btn bf-btn--ghost"
            title="Exporta CSV del servidor (no distingue facial/placa)"
            onClick={() => exportAccessCSV(q)}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bf-grid-7">
        <input
          className="bf-input"
          placeholder="Desde (YYYY-MM-DD)"
          value={q.from}
          onChange={(e) => setQ({ ...q, from: e.target.value })}
        />
        <input
          className="bf-input"
          placeholder="Hasta (YYYY-MM-DD)"
          value={q.to}
          onChange={(e) => setQ({ ...q, to: e.target.value })}
        />
        <input
          className="bf-input"
          placeholder="Cámara"
          value={q.camera_id}
          onChange={(e) => setQ({ ...q, camera_id: e.target.value })}
        />
        <select
          className="bf-input"
          value={q.decision}
          onChange={(e) => setQ({ ...q, decision: e.target.value })}
        >
          <option value="">(todas decisiones)</option>
          <option>ALLOW_RESIDENT</option>
          <option>DENY_UNKNOWN</option>
          <option>ERROR_OCR</option>
        </select>
        <select
          className="bf-input"
          value={q.direction}
          onChange={(e) => setQ({ ...q, direction: e.target.value })}
        >
          <option value="">(todas direcciones)</option>
          <option value="ENTRADA">ENTRADA</option>
          <option value="SALIDA">SALIDA</option>
        </select>
        <select
          className="bf-input"
          value={q.opened}
          onChange={(e) => setQ({ ...q, opened: e.target.value })}
        >
          <option value="">(abrió o no)</option>
          <option value="true">Sí abrió</option>
          <option value="false">No abrió</option>
        </select>
        <input
          className="bf-input"
          placeholder="Score mínimo (0..1)"
          value={q.min_score}
          onChange={(e) => setQ({ ...q, min_score: e.target.value })}
        />
      </div>

      {error && <div className="bf-alert bf-alert--error">{error}</div>}

      {loading ? (
        <p>Cargando…</p>
      ) : rows.length === 0 ? (
        <div className="bf-empty">Sin eventos faciales con los filtros aplicados.</div>
      ) : (
        <table className="bf-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cam</th>
              <th>Dir</th>
              <th>Similaridad</th>
              <th>Decisión</th>
              <th>Abrió</th>
              <th>Usuario</th>
              <th>ExternalID</th>
              <th>Snapshot</th>
              <th>Raw</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const sim = pct(r.score);
              const extId = r?.payload?.external_id || r?.reason || "-";
              const uid = r?.payload?.matched_user_id || null;
              const u = uid ? userCache[uid] : null;
              const name =
                u
                  ? `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
                    u.username ||
                    u.email ||
                    `ID ${u.id}`
                  : uid
                  ? `ID ${uid}`
                  : "-";
              const snapUrl = r?.snapshot ? `${import.meta.env.VITE_API_BASE}${r.snapshot}` : "";

              return (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.camera_id || "-"}</td>
                  <td>{r.direction || "-"}</td>
                  <td>{sim}</td>
                  <td>
                    <span className={`bf-chip bf-chip--${(r.decision || "").toLowerCase()}`}>
                      {labelDecision(r.decision)}
                    </span>
                  </td>
                  <td>{r.opened ? "Sí" : "No"}</td>
                  <td className="bf-user">
                    {name}
                    {u?.email && <div className="bf-sub">{u.email}</div>}
                  </td>
                  <td>{extId}</td>
                  <td>
                    {snapUrl ? (
                      <a href={snapUrl} target="_blank" rel="noreferrer">ver</a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <details>
                      <summary>JSON</summary>
                      <pre className="bf-code">{JSON.stringify(r.payload, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
