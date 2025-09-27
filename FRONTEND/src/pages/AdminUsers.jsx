import { useEffect, useState, useMemo } from "react";
import { listUsers, createUser, updateUser, deleteUser, getRole } from "../api/auth";
import "./AdminUsers.css";

const ROLE_OPTIONS = ["PERSONAL", "RESIDENTE"];

export default function AdminUsers() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [mode, setMode] = useState("create");     // "create" | "edit"
  const [formOpen, setFormOpen] = useState(false);

  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "PERSONAL",
    password: "",
  });

  const me = JSON.parse(localStorage.getItem("me") || "null");
  const myRole = getRole(me);
  const canManage = useMemo(() => String(myRole || "").toUpperCase() === "ADMIN", [myRole]);

  function resetForm() {
    setEditingId(null);
    setMode("create");
    setForm({
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      role: "PERSONAL",
      password: "",
    });
  }

  function openCreate() {
    if (!canManage) return;
    resetForm();
    setMode("create");
    setFormOpen(true);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await listUsers(q ? { search: q } : undefined);
      setRows(Array.isArray(data) ? data : (data.results || []));
    } catch (e) {
      console.error(e);
      setError("No se pudo cargar la lista de usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!canManage) return;
    setError("");
    try {
      if (mode === "edit" && editingId) {
        await updateUser(editingId, form);
      } else {
        await createUser(form);
      }
      await load();
      setFormOpen(false);
      resetForm();
    } catch (e2) {
      console.error(e2);
      setError("No se pudo guardar. Revisa los campos.");
    }
  }

  function onEdit(u) {
    if (!canManage) return;
    setEditingId(u.id);
    setMode("edit");
    setForm({
      username: u.username || "",
      email: u.email || "",
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      role: (u.role || "PERSONAL").toUpperCase(),
      password: "", // vacío: no cambia
    });
    setFormOpen(true);
    setTimeout(() => {
      document.getElementById("au-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function onDelete(id) {
    if (!canManage) return;
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      await deleteUser(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar.");
    }
  }

  const rolePill = (r) => {
    const key = (r || "").toLowerCase();
    const map = { admin: "role--admin", personal: "role--personal", residente: "role--residente" };
    return <span className={`role ${map[key] || ""}`}>{(r || "-").toUpperCase()}</span>;
  };

  return (
    <div className="adminusers">
      <div className="page-head">
        <h1>Usuarios</h1>
        {!canManage && <p className="warn">Solo lectura. No tienes permisos para crear/editar.</p>}
      </div>

      {/* Toolbar */}
      <div className="card au-toolbar">
        <form className="au-toolbar__form" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <div className="au-field">
            <label className="au-label">Búsqueda</label>
            <input
              className="au-input"
              placeholder="usuario, email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <button type="submit" className="au-button">Buscar</button>
          <button
            type="button"
            className="au-button au-button--ghost"
            onClick={() => { setQ(""); load(); }}
          >
            Limpiar
          </button>

          <div className="au-toolbar__spacer" />
          <button
            type="button"
            className="au-button"
            onClick={openCreate}
            disabled={!canManage}
            title={canManage ? "" : "Requiere rol ADMIN"}
          >
            + Crear usuario
          </button>
        </form>
      </div>

      {/* Formulario */}
      {formOpen && (
        <form id="au-form" className="card au-form" onSubmit={onSubmit}>
          <div className="form-head">
            <h3>{mode === "edit" ? "Editar usuario" : "Nuevo usuario"}</h3>
          </div>
          {error && <p className="error">{error}</p>}

          <div className="au-form__grid">
            <div className="au-field">
              <label className="au-label">Usuario</label>
              <input
                className="au-input"
                name="username"
                value={form.username}
                onChange={onChange}
                required
                disabled={mode === "edit"}
              />
            </div>

            <div className="au-field">
              <label className="au-label">Email</label>
              <input
                className="au-input"
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
              />
            </div>

            <div className="au-field">
              <label className="au-label">Nombres</label>
              <input
                className="au-input"
                name="first_name"
                value={form.first_name}
                onChange={onChange}
              />
            </div>

            <div className="au-field">
              <label className="au-label">Apellidos</label>
              <input
                className="au-input"
                name="last_name"
                value={form.last_name}
                onChange={onChange}
              />
            </div>

            <div className="au-field">
              <label className="au-label">Rol</label>
              <select
                className="au-select"
                name="role"
                value={form.role}
                onChange={onChange}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="au-field">
              <label className="au-label">
                Contraseña {mode === "edit" ? "(deja vacío para no cambiar)" : ""}
              </label>
              <input
                className="au-input"
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
                placeholder={mode === "edit" ? "••••••••" : "mín. 6 caracteres"}
                required={mode !== "edit"}
              />
            </div>
          </div>

          <div className="au-actions">
            <button type="submit" className="au-button" disabled={!canManage}>
              {mode === "edit" ? "Guardar" : "Crear"}
            </button>
            <button
              type="button"
              className="au-button au-button--ghost"
              onClick={() => { setFormOpen(false); resetForm(); }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="card au-loading">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="card au-empty">No hay usuarios</div>
      ) : (
        <div className="card au-tablewrap">
          <table className="au-table">
            <colgroup>
              <col className="w-id" />
              <col className="w-user" />
              <col className="w-role" />
              <col className="w-email" />
              <col className="w-name" />
              <col className="w-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>ID</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Email</th>
                <th>Nombre</th>
                <th className="au-sticky-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{rolePill(u.role || u.rol || u.rolNombre)}</td>
                  <td>{u.email || "-"}</td>
                  <td>{[u.first_name, u.last_name].filter(Boolean).join(" ") || "-"}</td>
                  <td className="au-sticky-right">
                    <div className="au-row-actions">
                      <button
                        type="button"
                        className="au-button au-button--edit"
                        onClick={() => onEdit(u)}
                        disabled={!canManage}
                        title={canManage ? "" : "Requiere rol ADMIN"}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        className="au-button au-button--delete"
                        onClick={() => onDelete(u.id)}
                        disabled={!canManage}
                        title={canManage ? "" : "Requiere rol ADMIN"}
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
