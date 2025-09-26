// src/pages/Roles.jsx
import { useEffect, useState } from "react";
import { listRoles, createRole, updateRole, deleteRole } from "../api/roles";
import "./Roles.css";

const emptyForm = { code: "", name: "", description: "" };
const SYSTEM_ROLES = ["ADMIN", "STAFF", "RESIDENT"]; // por si tu API no manda is_system

export default function RolesPage() {
  const [page, setPage] = useState(null); // {count,next,previous,results}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  async function load(url) {
    setLoading(true);
    setError("");
    try {
      const data = await listRoles(url);
      setPage(data);
    } catch (e) {
      setError(parseErr(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]: name === "code" ? value.toUpperCase().trim() : value,
    }));
  }

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setCreateOpen(true);
  }
  function openEdit(role) {
    setEditId(role.id);
    setForm({
      code: role.code || "",
      name: role.name || "",
      description: role.description || "",
    });
    setCreateOpen(true);
  }
  function closeForm() {
    setCreateOpen(false);
    setForm(emptyForm);
    setEditId(null);
    setError("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (!editId) {
        await createRole(form);
      } else {
        // no permitir cambiar code desde UI para roles existentes (recomendado)
        const payload = { name: form.name, description: form.description };
        await updateRole(editId, payload);
      }
      closeForm();
      await load(); // recargar lista
    } catch (e2) {
      setError(parseErr(e2));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(role) {
    const isSystem = role.is_system ?? SYSTEM_ROLES.includes(role.code);
    if (isSystem) {
      alert("Este rol de sistema no se puede eliminar.");
      return;
    }
    if (!confirm(`¿Eliminar rol "${role.name || role.code}"?`)) return;
    setLoading(true);
    setError("");
    try {
      await deleteRole(role.id);
      await load();
    } catch (e) {
      setError(parseErr(e));
    } finally {
      setLoading(false);
    }
  }

  const isEmpty = !loading && page && page.results?.length === 0;

  return (
    <div className="roles">
      {/* Toolbar */}
      <div className="card au-toolbar">
        <form className="au-toolbar__form" onSubmit={(e) => e.preventDefault()}>
          <h3 className="m-0">Roles</h3>
          <div className="au-toolbar__spacer" />
          <button type="button" className="au-button" onClick={openCreate}>
            + Crear rol
          </button>
        </form>
      </div>

      {/* Formulario crear/editar */}
      {createOpen && (
        <form className="card au-form" onSubmit={onSubmit}>
          <div className="form-head">
            <h3 className="m-0">{editId ? "Editar rol" : "Nuevo rol"}</h3>
          </div>
          {error && <p className="error">{error}</p>}

          <div className="au-form__grid">
            <div className="au-field">
              <label className="au-label">Código</label>
              <input
                className="au-input"
                name="code"
                value={form.code}
                onChange={onChange}
                placeholder="ADMIN / STAFF / RESIDENT"
                required
                disabled={!!editId} /* no cambiar code al editar */
              />
            </div>

            <div className="au-field">
              <label className="au-label">Nombre</label>
              <input
                className="au-input"
                name="name"
                value={form.name}
                onChange={onChange}
                required
              />
            </div>

            <div className="au-field au-field--full">
              <label className="au-label">Descripción</label>
              <textarea
                className="au-input"
                name="description"
                value={form.description}
                onChange={onChange}
                rows={3}
              />
            </div>
          </div>

          <div className="au-actions">
            <button type="submit" className="au-button" disabled={loading}>
              {editId ? "Guardar cambios" : "Crear rol"}
            </button>
            <button type="button" className="au-button au-button--ghost" onClick={closeForm}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tabla + estados */}
      <div className="card">
        {loading && <p className="muted">Cargando…</p>}
        {error && !createOpen && <p className="error">{error}</p>}

        {page && (
          <>
            <div className="au-tablewrap">
              <table className="au-table">
                <thead>
                  <tr>
                    <th className="w-id">ID</th>
                    <th className="w-code">Código</th>
                    <th className="w-name">Nombre</th>
                    <th>Descripción</th>
                    <th className="w-actions" />
                  </tr>
                </thead>
                <tbody>
                  {page.results.map((r) => {
                    const system = r.is_system ?? SYSTEM_ROLES.includes(r.code);
                    return (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td>
                          <span className={`role ${system ? "role--system" : ""}`}>
                            {r.code}
                          </span>
                        </td>
                        <td>{r.name || "-"}</td>
                        <td>
                          <span className="ellipsis">{r.description || "-"}</span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="au-button au-button--ghost"
                              type="button"
                              onClick={() => openEdit(r)}
                            >
                              Editar
                            </button>
                            <button
                              className="au-button au-button--danger"
                              type="button"
                              onClick={() => onDelete(r)}
                              disabled={system}
                              title={system ? "Rol de sistema: no eliminable" : ""}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {isEmpty && (
                    <tr>
                      <td colSpan={5} className="txt-center muted p-16">
                        Sin roles.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="pager">
              <button
                type="button"
                className="au-button au-button--ghost"
                disabled={!page.previous || loading}
                onClick={() => load(page.previous)}
              >
                ← Anterior
              </button>
              <span className="muted">
                {page.count ?? page.results.length} total
              </span>
              <button
                type="button"
                className="au-button au-button--ghost"
                disabled={!page.next || loading}
                onClick={() => load(page.next)}
              >
                Siguiente →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function parseErr(e) {
  // mensajes más amigables
  const d = e?.response?.data || e?.data || e;
  if (!d) return "Error desconocido";
  if (typeof d === "string") return d;
  if (typeof d.detail === "string") return d.detail;
  try {
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join(" | ");
  } catch {
    return "Error de red";
  }
}
