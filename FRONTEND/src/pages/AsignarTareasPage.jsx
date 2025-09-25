// src/pages/AsignarTareasPage.jsx
import { useEffect, useMemo, useState } from "react";
import { listTasks, listUsers, assignTask } from "../api/tareas";

// helpers
function roleCodeOf(u) {
  const r =
    u?.profile?.role?.code ||
    u?.profile?.role_code ||
    (typeof u?.role === "string" ? u.role : u?.role?.code) ||
    u?.role_code ||
    u?.rolCodigo ||
    u?.rolCodigo?.code ||
    u?.rol?.code ||
    (typeof u?.rol === "string" ? u.rol : null);
  return r ? String(r).toUpperCase() : null;
}
function nombreCompleto(u) {
  const n = u?.nombre ?? u?.first_name ?? "";
  const a = u?.apellidos ?? u?.last_name ?? "";
  const s = [n, a].filter(Boolean).join(" ").trim();
  return s || "—";
}

export default function AsignarTareasPage() {
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  // selects (estilo igual al formulario de Tareas: ambos simples)
  const [tareaId, setTareaId] = useState("");
  const [staffId, setStaffId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [ts, us] = await Promise.all([
          listTasks({ ordering: "-updated_at" }),
          listUsers({ ordering: "id" }),
        ]);
        setTareas(Array.isArray(ts) ? ts : []);
        setUsuarios(Array.isArray(us) ? us : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Solo personal STAFF, ordenado
  const staff = useMemo(
    () =>
      usuarios
        .filter((u) => roleCodeOf(u) === "STAFF")
        .sort((a, b) => String(a.username).localeCompare(String(b.username))),
    [usuarios]
  );

  const guardar = async () => {
    setErr("");
    setMsg("");
    if (!tareaId) return setErr("Selecciona una tarea.");
    if (!staffId) return setErr("Selecciona un miembro del staff.");
    setSaving(true);
    try {
      await assignTask(Number(tareaId), {
        user_id: Number(staffId),
        rol_id: null,
      });
      setMsg("Asignación guardada correctamente.");
    } catch (e) {
      console.error(e);
      setErr(
        "No se pudo guardar la asignación. Revisa el endpoint de asignación."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Asignar tarea a Personal (Staff)</h2>

      <div className="card" style={{ paddingTop: 14 }}>
        {/* Tarea (select simple) */}
        <div className="au-field" style={{ marginBottom: 12 }}>
          <label className="au-label" style={{ fontWeight: 700 }}>
            Tarea
          </label>
          <select
            className="au-input"
            value={tareaId}
            onChange={(e) => setTareaId(e.target.value)}
            disabled={loading}
          >
            <option value="">Seleccione una tarea…</option>
            {tareas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titulo || `Tarea #${t.id}`}
              </option>
            ))}
          </select>
        </div>

        {/* Personal (select simple) */}
        <div className="au-field" style={{ marginBottom: 12 }}>
          <label className="au-label" style={{ fontWeight: 700 }}>
            Personal (STAFF)
          </label>
          <select
            className="au-input"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            disabled={loading}
          >
            <option value="">Seleccione personal…</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                @{u.username} — {nombreCompleto(u)}
                {u.email ? ` — ${u.email}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Footer / acciones */}
        <div
          style={{
            marginTop: 8,
            paddingTop: 10,
            borderTop: "1px solid #111827",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {err && <div style={{ color: "#ef4444", flex: 1 }}>{err}</div>}
          {msg && <div style={{ color: "#22c55e", flex: 1 }}>{msg}</div>}
          <button
            className="au-button"
            onClick={guardar}
            disabled={saving || loading}
          >
            {saving ? "Guardando…" : "Guardar Asignación"}
          </button>
        </div>
      </div>
    </div>
  );
}
