// src/pages/Roles.jsx
import { useEffect, useState } from "react";
import { listRoles, createRole, updateRole, deleteRole } from "../api/roles";

const emptyForm = { code: "", name: "", description: "" };

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
    if (name === "code") {
      // normaliza como en el serializer: trim + upper
      setForm((f) => ({ ...f, code: value.toUpperCase() }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  }

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setCreateOpen(true);
  }
  function openEdit(role) {
    setEditId(role.id);
    setForm({
      code: role.code,
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
        // si es rol del sistema, no permitas cambiar "code" desde UI
        const payload = { name: form.name, description: form.description };
        // si quisieras permitir code, agrega code: form.code
        await updateRole(editId, payload);
      }
      closeForm();
      await load(); // recargar lista
    } catch (e) {
      setError(parseErr(e));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(role) {
    if (role.is_system) {
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

  return (
    <div>
      {/* TOOLBAR */}
      <div className="card au-toolbar" style={{ marginBottom: 16 }}>
        <form className="au-toolbar__form" onSubmit={(e) => e.preventDefault()}>
          <h3 style={{ margin: 0 }}>Roles</h3>
          <div className="au-toolbar__spacer" />
          <button type="button" className="au-button" onClick={openCreate}>
            + Crear rol
          </button>
        </form>
      </div>

      {/* FORM: crear/editar */}
      {createOpen && (
        <form className="card au-form" onSubmit={onSubmit} style={{ marginBottom: 16 }}>
          <h3>{editId ? "Editar rol" : "Nuevo rol"}</h3>
          {error && <p className="error">{error}</p>}

          <label>Código</label>
          <input
            name="code"
            value={form.code}
            onChange={onChange}
            required
            placeholder="ADMIN / STAFF / GUARD"
            disabled={!!editId} // no cambiar code al editar (recomendado)
            className="au-input"
          />

          <label>Nombre</label>
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            required
            className="au-input"
          />

          <label>Descripción</label>
          <textarea
            name="description"
            value={form.description}
            onChange={onChange}
            rows={3}
            className="au-input"
          />

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="submit" className="au-button" disabled={loading}>
              {editId ? "Guardar cambios" : "Crear rol"}
            </button>
            <button type="button" className="au-button au-button--ghost" onClick={closeForm}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* TABLA */}
      <div className="card">
        {loading && <p>Cargando...</p>}
        {error && !createOpen && <p className="error">{error}</p>}
        {page && (
          <>
            <table className="au-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {page.results.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.code}</td>
                    <td>{r.name || "-"}</td>
                    <td style={{ maxWidth: 360, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.description || "-"}
                    </td>
                    
                    <td className="actions">
                        <button className="au-button au-button--ghost" onClick={() => openEdit(r)}>Editar</button>
                        <button
                            className="au-button au-button--danger"
                            onClick={() => onDelete(r)}
                            disabled={(r.is_system ?? ["ADMIN","STAFF","RESIDENT"].includes(r.code))}
                            title={(r.is_system ?? ["ADMIN","STAFF","RESIDENT"].includes(r.code)) ? "Rol de sistema: no eliminable" : ""}
                        >
                            Eliminar
                        </button>
                        </td>
                  </tr>
                ))}
                {page.results.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 16 }}>
                      Sin roles.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

function parseErr(e) {
  if (!e) return "Error desconocido";
  if (typeof e === "string") return e;
  if (e.detail) return e.detail;
  try {
    return JSON.stringify(e);
  } catch {
    return "Error de red";
  }
}
