// src/pages/StaffPage.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  listStaff, createStaff, updateStaff, deleteStaff, listStaffRoles,
} from "../api/staff";
import StaffForm from "../components/StaffForm";
import "./StaffPage.css";

export default function StaffPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [roles, setRoles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesData, listData] = await Promise.all([
        listStaffRoles(),
        listStaff({ search: q, page }),
      ]);
      setRoles(
        rolesData?.length
          ? rolesData
          : [{ id: 0, code: "STAFF", name: "Personal (básico)", base: "STAFF" }]
      );
      setRows(listData?.results || []);
      setCount(listData?.count ?? (listData?.results || []).length);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.detail || "No se pudo cargar personal.");
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(row) {
    setEditing(row);
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  async function handleSubmit(form) {
    setSubmitting(true);
    try {
      if (editing) {
        await updateStaff(editing.id, form);
      } else {
        await createStaff(form);
      }
      closeForm();
      await load();
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data || e?.message || "Error al guardar";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`¿Eliminar a ${row.username}?`)) return;
    try {
      await deleteStaff(row.id);
      await load();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.detail || "No se pudo eliminar.");
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / 10)), [count]);

  return (
    <div className="page page--staff">
      <div className="card head">
        <div className="head__row">
          <h2>Personal del condominio</h2>
          <span className="muted head__count">{count} registros</span>
        </div>

        <div className="toolbar">
          <input
            className="inp"
            placeholder="Buscar por usuario, nombre, email…"
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
            aria-label="Buscar personal"
          />
          <button className="btn" onClick={openCreate}>+ Nuevo personal</button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="skeleton-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="skeleton-row" key={i} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="empty">No hay personal.</div>
        ) : (
          <div className="table-wrap">
            <table className="tbl tbl--compact">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Staff kind</th>
                  <th>Activo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="ID">{r.id}</td>
                    <td data-label="Usuario">{r.username}</td>
                    <td data-label="Nombre">
                      {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td data-label="Email">{r.email || "—"}</td>
                    <td data-label="Rol">
                      <span className="chip">{r.role || "STAFF"}</span>{" "}
                      {r.role_base && r.role_base !== "STAFF" && (
                        <span className="chip warn" title={`Base: ${r.role_base}`}>
                          base:{r.role_base}
                        </span>
                      )}
                    </td>
                    <td data-label="Staff kind">{r.staff_kind || "—"}</td>
                    <td data-label="Activo">{r.is_active ? "Sí" : "No"}</td>
                    <td className="actions" data-label="Acciones">
                      <button className="btn ghost" onClick={() => openEdit(r)}>Editar</button>
                      <button className="btn danger" onClick={() => handleDelete(r)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pager" role="navigation" aria-label="Paginación">
              <button
                className="btn ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
              <span className="muted">Página {page} de {totalPages}</span>
              <button
                className="btn ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={closeForm} />
          <div className="modal__content">
            <div className="modal__head">
              <h3>{editing ? "Editar personal" : "Nuevo personal"}</h3>
              <button className="btn ghost" onClick={closeForm} aria-label="Cerrar">✕</button>
            </div>
            <StaffForm
              initial={editing}
              roles={roles}
              submitting={submitting}
              onSubmit={handleSubmit}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}
    </div>
  );
}
