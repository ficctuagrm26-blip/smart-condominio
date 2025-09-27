// src/pages/PersonalPage.jsx
import { useEffect, useMemo, useState } from "react";
import { listStaff, createStaff, updateStaff, deleteStaff } from "../api/staff";
import "./PersonalPage.css";

/** Campos mostrados para cada persona del staff */
const COLUMNS = [
  { key: "id", label: "ID", w: 80 },
  { key: "username", label: "Usuario", w: 220 },
  { key: "email", label: "Email", w: 280 },
  { key: "name", label: "Nombre", w: 260 },
];

/** Form vacío */
const emptyForm = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  password: "",
};

export default function PersonalPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // UI form
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const count = rows.length;
  const visible = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(
      (r) =>
        (r.username || "").toLowerCase().includes(s) ||
        (r.email || "").toLowerCase().includes(s) ||
        (`${r.first_name || ""} ${r.last_name || ""}`.trim().toLowerCase().includes(s))
    );
  }, [rows, q]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await listStaff();
      setRows(data);
    } catch (e) {
      console.error(e);
      setErr("No se pudo cargar el personal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditingId(null);
    setMode("create");
    setForm(emptyForm);
    setOpen(true);
  }

  function onEdit(u) {
    setEditingId(u.id);
    setMode("edit");
    setForm({
      username: u.username || "",
      email: u.email || "",
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      password: "", // vacío = no cambiar
    });
    setOpen(true);
  }

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      if (mode === "edit" && editingId) {
        await updateStaff(editingId, form);
      } else {
        await createStaff(form);
      }
      setOpen(false);
      setForm(emptyForm);
      await load();
    } catch (e2) {
      console.error(e2);
      setErr("No se pudo guardar. Revisa los campos.");
    }
  }

  async function onDelete(id) {
    if (!confirm("¿Eliminar este personal?")) return;
    try {
      await deleteStaff(id);
      setRows((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar.");
    }
  }

  return (
    <div className="ppage">
      <div className="ppage__title">
        <h1>Personal</h1>
        <div className="ppage__toolbar">
          <div className="field">
            <label>Búsqueda</label>
            <input
              className="input"
              placeholder="usuario, email, nombre…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="spacer" />
          <button className="btn" onClick={openCreate}>+ Nuevo personal</button>
        </div>
      </div>

      {open && (
        <form className="card form" onSubmit={onSubmit}>
          <div className="form__head">
            <h3>{mode === "edit" ? "Editar personal" : "Nuevo personal"}</h3>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>

          {err && <p className="error">{err}</p>}

          <div className="grid">
            <div className="field">
              <label>Usuario *</label>
              <input
                className="input"
                name="username"
                required
                value={form.username}
                onChange={onChange}
                disabled={mode === "edit"}
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                className="input"
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
              />
            </div>
            <div className="field">
              <label>Nombres</label>
              <input
                className="input"
                name="first_name"
                value={form.first_name}
                onChange={onChange}
              />
            </div>
            <div className="field">
              <label>Apellidos</label>
              <input
                className="input"
                name="last_name"
                value={form.last_name}
                onChange={onChange}
              />
            </div>
            <div className="field">
              <label>
                Contraseña {mode === "edit" ? "(vacío = sin cambio)" : "*"}
              </label>
              <input
                className="input"
                type="password"
                name="password"
                value={form.password}
                onChange={onChange}
                required={mode !== "edit"}
                placeholder={mode === "edit" ? "••••••••" : "mín. 6 caracteres"}
              />
            </div>
          </div>

          <div className="actions">
            <button className="btn" type="submit">
              {mode === "edit" ? "Guardar" : "Crear"}
            </button>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="card tablecard">
        <div className="tablehead">
          <div className="muted">{visible.length} de {count} registros</div>
        </div>

        {loading ? (
          <div className="loading">Cargando…</div>
        ) : visible.length === 0 ? (
          <div className="empty">Sin resultados</div>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <colgroup>
                {COLUMNS.map((c, i) => (
                  <col key={c.key} style={{ width: c.w ? `${c.w}px` : undefined }} />
                ))}
                <col style={{ width: "220px" }} />
              </colgroup>
              <thead>
                <tr>
                  {COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}
                  <th className="sticky">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.username}</td>
                    <td>{u.email || "—"}</td>
                    <td>{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</td>
                    <td className="sticky">
                      <div className="rowactions">
                        <button className="btn btn--edit" onClick={() => onEdit(u)}>✏️ Editar</button>
                        <button className="btn btn--danger" onClick={() => onDelete(u.id)}>🗑️ Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
