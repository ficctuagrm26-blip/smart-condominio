// src/pages/AdminUsers.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { api } from "../api/auth";

// Fallback de roles si /admin/roles/ no responde
const ROLE_OPTIONS_FALLBACK = [
  { code: "ADMIN", label: "Administrador" },
  { code: "STAFF", label: "Personal/Staff" },
  { code: "RESIDENT", label: "Residente" },
];

/* ---------------- helpers robustos ---------------- */
function unwrap(data) {
  if (!data) return { results: [], next: null, previous: null, count: 0 };
  if (data.values) {
    const v = data.values;
    if (Array.isArray(v))
      return { results: v, next: null, previous: null, count: v.length };
    if (v.results)
      return {
        results: v.results,
        next: v.next || null,
        previous: v.previous || null,
        count: v.count ?? v.results.length,
      };
    const fa = Object.values(v).find(Array.isArray);
    if (Array.isArray(fa))
      return { results: fa, next: null, previous: null, count: fa.length };
  }
  if (Array.isArray(data?.results))
    return {
      results: data.results,
      next: data.next || null,
      previous: data.previous || null,
      count: data.count ?? data.results.length,
    };
  if (Array.isArray(data))
    return { results: data, next: null, previous: null, count: data.length };
  const fa = data ? Object.values(data).find(Array.isArray) : null;
  if (Array.isArray(fa))
    return { results: fa, next: null, previous: null, count: fa.length };
  return { results: [], next: null, previous: null, count: 0 };
}
function normalizeRoleFromName(name) {
  if (!name) return null;
  const s = String(name).trim().toLowerCase();
  if (["admin", "administrador"].includes(s)) return "ADMIN";
  if (["staff", "personal", "personal/staff", "personal de staff"].includes(s))
    return "STAFF";
  if (["residente", "residents", "resident"].includes(s)) return "RESIDENT";
  return null;
}
function roleCodeOf(u) {
  const r =
    u?.profile?.role?.code ||
    u?.profile?.role_code ||
    (typeof u?.role === "string" ? u.role : u?.role?.code) ||
    u?.role_code ||
    u?.rolCodigo ||
    u?.rolCodigo?.code ||
    u?.rol?.code ||
    (u?.rolNombre && normalizeRoleFromName(u.rolNombre)) ||
    (typeof u?.idRol === "object"
      ? u?.idRol?.code || u?.idRol?.codigo
      : null) ||
    (typeof u?.rol === "string" ? u.rol : null);
  return r ? String(r).toUpperCase() : null;
}
function roleNameOf(u, catalog = ROLE_OPTIONS_FALLBACK) {
  if (u?.profile?.role?.name) return u.profile.role.name;
  if (u?.role?.name) return u.role.name;
  if (u?.rolNombre) return u.rolNombre;
  const code = roleCodeOf(u);
  const found = catalog.find((r) => r.code === code);
  return found ? found.label : code || "—";
}
function fullNameOf(u) {
  const nombre = u?.nombre ?? u?.nombres ?? u?.first_name ?? u?.name ?? "";
  const apellidos = u?.apellidos ?? u?.last_name ?? u?.lastname ?? "";
  const s = [nombre, apellidos].filter(Boolean).join(" ").trim();
  return s || "—";
}

/* PATCH básicos */
async function patchUserBasicsFlexible(userId, payload) {
  const bodyPatch = {
    ...(payload.email !== undefined ? { email: payload.email } : {}),
    ...(payload.nombre !== undefined ? { nombre: payload.nombre } : {}),
    ...(payload.apellidos !== undefined
      ? { apellidos: payload.apellidos }
      : {}),
    ...(payload.is_active !== undefined
      ? { is_active: payload.is_active }
      : {}),
    ...(payload.first_name !== undefined
      ? { first_name: payload.first_name }
      : {}),
    ...(payload.last_name !== undefined
      ? { last_name: payload.last_name }
      : {}),
  };
  try {
    const r = await api.patch(`admin/users/${userId}/`, bodyPatch);
    return r.data;
  } catch (e) {
    const r = await api.put(`admin/users/${userId}/`, {
      email: payload.email ?? null,
      first_name: payload.first_name ?? payload.nombre ?? null,
      last_name: payload.last_name ?? payload.apellidos ?? null,
      is_active: payload.is_active ?? true,
    });
    return r.data;
  }
}
async function patchUserRoleFlexible(userId, roleIdOrCode) {
  const body = {};
  if (roleIdOrCode == null || roleIdOrCode === "") {
    body.role_id = null;
  } else if (!Number.isNaN(Number(roleIdOrCode))) {
    body.role_id = Number(roleIdOrCode);
  } else {
    body.role_code = String(roleIdOrCode).toUpperCase();
  }
  const r = await api.patch(`admin/users/${userId}/`, body);
  return r.data;
}

/* ------------------------ componente ------------------------ */
export default function AdminUsers() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // lee ?group=staff | residents | residentes | (vacío => todos)
  const group = (searchParams.get("group") || "").toLowerCase();

  const [users, setUsers] = useState([]);
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState("");
  const [roleCatalog, setRoleCatalog] = useState(ROLE_OPTIONS_FALLBACK);

  // crear
  const [openCreate, setOpenCreate] = useState(false);
  const [nu, setNu] = useState({
    username: "",
    email: "",
    nombre: "",
    apellidos: "",
    password: "",
    role_code: "",
  });
  const [createErr, setCreateErr] = useState("");

  // editar
  const [openEdit, setOpenEdit] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [eu, setEu] = useState({
    email: "",
    nombre: "",
    apellidos: "",
    is_active: true,
    role_code: "",
  });
  const [editErr, setEditErr] = useState("");

  const load = async (opts = {}) => {
    setLoading(true);
    setFlash("");
    try {
      const r = await api.get("admin/users/", {
        params: { q: searchParams.get("q") || undefined, ...opts },
      });
      const data = unwrap(r.data);
      setUsers(data.results);

      try {
        const rr = await api.get("admin/roles/");
        const arr = unwrap(rr.data).results;
        if (arr.length) {
          const normalized = arr
            .map((it) => ({
              code: (
                it.code ||
                it.codigo ||
                it.name ||
                it.nombre ||
                ""
              ).toUpperCase(),
              label: it.name || it.nombre || it.code || it.codigo,
              id: it.id,
            }))
            .filter((x) => x.code);
          if (normalized.length) setRoleCatalog(normalized);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  // ✅ recarga cuando cambian PATH o QUERY (incluye ?group= y ?q=) y sincroniza el input
  useEffect(() => {
    setQ(searchParams.get("q") || "");
    // al entrar a vistas con group, cierra modales de creación
    if (group) setOpenCreate(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  // derivados por rol
  const admins = useMemo(
    () => users.filter((u) => roleCodeOf(u) === "ADMIN"),
    [users]
  );
  const staff = useMemo(
    () => users.filter((u) => roleCodeOf(u) === "STAFF"),
    [users]
  );
  const residents = useMemo(
    () => users.filter((u) => roleCodeOf(u) === "RESIDENT"),
    [users]
  );

  // lista visible según ?group=
  const visibleList = useMemo(() => {
    if (group === "staff") return staff;
    if (group === "residents" || group === "residentes") return residents;
    return users;
  }, [group, staff, residents, users]);

  const pageTitle = useMemo(() => {
    if (group === "staff") return "Personal (STAFF)";
    if (group === "residents" || group === "residentes") return "Residentes";
    return "Usuarios";
  }, [group]);

  /* ------------------------- búsqueda ------------------------- */
  const onSearch = (e) => {
    e?.preventDefault?.();
    const next = new URLSearchParams(location.search);
    if (q) next.set("q", q);
    else next.delete("q");
    // mantiene el group actual
    if (group) next.set("group", group);
    setSearchParams(next, { replace: false });
    // el efecto superior se encarga de llamar a load() al cambiar location.search
  };

  const clearSearch = () => {
    const next = new URLSearchParams(location.search);
    next.delete("q");
    if (group) next.set("group", group);
    setSearchParams(next, { replace: false });
    // el efecto superior recargará y además seteará q=""
  };

  /* ------------------------- crear ------------------------- */
  const onNewChange = (e) => {
    const { name, value } = e.target;
    setNu((s) => ({ ...s, [name]: value }));
  };

  const submitCreate = async () => {
    setCreateErr("");
    try {
      const regPayload = {
        username: nu.username.trim(),
        password: nu.password,
        email: nu.email.trim() || undefined,
        nombre: nu.nombre.trim() || undefined,
        apellidos: nu.apellidos.trim() || undefined,
        ...(nu.role_code
          ? { role_code: String(nu.role_code).toUpperCase() }
          : {}),
      };
      const created = await api.post("auth/register/", regPayload);
      const newId =
        created?.data?.values?.user?.id ??
        created?.data?.user?.id ??
        created?.data?.id ??
        null;

      if (newId) {
        try {
          await patchUserBasicsFlexible(newId, {
            email: nu.email || null,
            nombre: nu.nombre || null,
            apellidos: nu.apellidos || null,
          });
        } catch {}
        if (nu.role_code) {
          try {
            await patchUserRoleFlexible(newId, nu.role_code);
          } catch {}
        }
      }

      setOpenCreate(false);
      setNu({
        username: "",
        email: "",
        nombre: "",
        apellidos: "",
        password: "",
        role_code: "",
      });
      setFlash("Usuario creado correctamente.");
      // recarga por si backend no incluye al nuevo en la primera página
      await load();
    } catch (err) {
      const d = err?.response?.data;
      const msg =
        d && typeof d === "object"
          ? Object.entries(d)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join(" | ")
          : err?.message || "No se pudo crear";
      setCreateErr(msg);
    }
  };

  /* ------------------------- editar ------------------------- */
  const openEditModal = (u) => {
    setEditUser(u);
    setEu({
      email: u.email || "",
      nombre: u.nombre ?? u.nombres ?? u.first_name ?? "",
      apellidos: u.apellidos ?? u.last_name ?? "",
      is_active: !!u.is_active,
      role_code: roleCodeOf(u) || "",
    });
    setEditErr("");
    setOpenEdit(true);
  };

  const onEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEu((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
  };

  const submitEdit = async () => {
    setEditErr("");
    try {
      await patchUserBasicsFlexible(editUser.id, {
        email: eu.email || null,
        nombre: eu.nombre || null,
        apellidos: eu.apellidos || null,
        is_active: !!eu.is_active,
      });

      const currentCode = roleCodeOf(editUser) || "";
      if ((eu.role_code || "") !== currentCode) {
        await patchUserRoleFlexible(editUser.id, eu.role_code || null);
      }

      setOpenEdit(false);
      setEditUser(null);
      setFlash("Usuario actualizado.");
      await load();
    } catch (err) {
      const d = err?.response?.data;
      const msg =
        d && typeof d === "object"
          ? Object.entries(d)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join(" | ")
          : err?.message || "No se pudo actualizar";
      setEditErr(msg);
    }
  };

  /* ------------------------- eliminar ------------------------- */
  const onDelete = async (u) => {
    if (!confirm(`¿Eliminar usuario "${u.username}"?`)) return;
    try {
      await api.delete(`admin/users/${u.id}/`);
      setFlash("Usuario eliminado.");
      await load();
    } catch {
      alert("No se pudo eliminar");
    }
  };

  return (
    <div className="page">
      {/* Toolbar */}
      <div className="card" style={{ marginBottom: 12 }}>
        <form className="au-toolbar__form" onSubmit={onSearch}>
          <div className="au-field">
            <label className="au-label">Búsqueda</label>
            <input
              className="au-input"
              placeholder="usuario, email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <button type="submit" className="au-button">
            Buscar
          </button>
          <button
            type="button"
            className="au-button au-button--ghost"
            onClick={clearSearch}
          >
            Limpiar
          </button>

          <div style={{ flex: 1 }} />

          {/* Botón crear sólo cuando estamos en la vista 'Usuarios' (todos) */}
          {!group && (
            <button
              type="button"
              className="au-button au-button--ghost"
              onClick={() => setOpenCreate(true)}
            >
              + Nuevo usuario
            </button>
          )}
        </form>
      </div>

      {/* Tabla principal */}
      <div className="card" style={{ overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>{pageTitle}</h3>
        <table className="au-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Activo</th>
              <th style={{ width: 220 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7}>Cargando…</td>
              </tr>
            )}
            {!loading && visibleList.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center" }}>
                  Sin resultados
                </td>
              </tr>
            )}
            {!loading &&
              visibleList.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{fullNameOf(u)}</td>
                  <td>{u.email || "—"}</td>
                  <td>{roleNameOf(u, roleCatalog)}</td>
                  <td>{u.is_active ? "Sí" : "No"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="au-button"
                        type="button"
                        onClick={() => openEditModal(u)}
                      >
                        Editar
                      </button>
                      <button
                        className="au-button au-button--danger"
                        type="button"
                        onClick={() => onDelete(u)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Resúmenes sólo en vista "Usuarios" */}
      {!group && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Resumen por rol</h3>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>Admins: {admins.length}</span>
            <span>Staff: {staff.length}</span>
            <span>Residentes: {residents.length}</span>
          </div>
        </div>
      )}

      {flash && (
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ margin: 0 }}>{flash}</p>
        </div>
      )}

      {/* Modal crear: sólo en vista "Usuarios" */}
      {openCreate && !group && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            display: "grid",
            placeItems: "center",
            zIndex: 90,
          }}
        >
          <div
            className="modal"
            style={{
              width: "min(680px,92vw)",
              background: "#111827",
              color: "#e5e7eb",
              border: "1px solid #1f2937",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 20px 80px rgba(0,0,0,.45)",
            }}
          >
            <div
              className="tarea-head"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <h3 className="tarea-title" style={{ margin: 0 }}>
                Nuevo usuario
              </h3>
              <button
                className="au-button au-button--ghost"
                type="button"
                onClick={() => setOpenCreate(false)}
              >
                ✕
              </button>
            </div>

            {createErr && <p className="error">{createErr}</p>}

            <div className="au-grid-2" style={{ marginTop: 8 }}>
              <div className="au-field">
                <label className="au-label">Usuario *</label>
                <input
                  className="au-input"
                  name="username"
                  value={nu.username}
                  onChange={onNewChange}
                  required
                />
              </div>
              <div className="au-field">
                <label className="au-label">Email</label>
                <input
                  className="au-input"
                  type="email"
                  name="email"
                  value={nu.email}
                  onChange={onNewChange}
                />
              </div>
              <div className="au-field">
                <label className="au-label">Nombre</label>
                <input
                  className="au-input"
                  name="nombre"
                  value={nu.nombre}
                  onChange={onNewChange}
                />
              </div>
              <div className="au-field">
                <label className="au-label">Apellidos</label>
                <input
                  className="au-input"
                  name="apellidos"
                  value={nu.apellidos}
                  onChange={onNewChange}
                />
              </div>
              <div className="au-field">
                <label className="au-label">Password *</label>
                <input
                  className="au-input"
                  type="password"
                  name="password"
                  value={nu.password}
                  onChange={onNewChange}
                  required
                />
              </div>
              <div className="au-field">
                <label className="au-label">Rol</label>
                <select
                  className="au-input"
                  name="role_code"
                  value={nu.role_code}
                  onChange={onNewChange}
                >
                  <option value="">(por defecto)</option>
                  {roleCatalog.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 12,
              }}
            >
              <button
                className="au-button"
                type="button"
                onClick={submitCreate}
              >
                Crear
              </button>
              <button
                className="au-button au-button--ghost"
                type="button"
                onClick={() => setOpenCreate(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {openEdit && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            display: "grid",
            placeItems: "center",
            zIndex: 90,
          }}
        >
          <div
            className="modal"
            style={{
              width: "min(680px,92vw)",
              background: "#111827",
              color: "#e5e7eb",
              border: "1px solid #1f2937",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 20px 80px rgba(0,0,0,.45)",
            }}
          >
            <div
              className="tarea-head"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <h3 className="tarea-title" style={{ margin: 0 }}>
                Editar usuario
              </h3>
              <button
                className="au-button au-button--ghost"
                type="button"
                onClick={() => setOpenEdit(false)}
              >
                ✕
              </button>
            </div>

            {editErr && <p className="error">{editErr}</p>}

            <div className="au-grid-2" style={{ marginTop: 8 }}>
              <div className="au-field">
                <label className="au-label">Email</label>
                <input
                  className="au-input"
                  name="email"
                  value={eu.email}
                  onChange={onEditChange}
                />
              </div>
              <div className="au-field">
                <label className="au-label">Nombre</label>
                <input
                  className="au-input"
                  name="nombre"
                  value={eu.nombre}
                  onChange={onEditChange}
                />
              </div>
              <div className="au-field">
                <label className="au-label">Apellidos</label>
                <input
                  className="au-input"
                  name="apellidos"
                  value={eu.apellidos}
                  onChange={onEditChange}
                />
              </div>
              <div className="au-field">
                <label className="au-label">Activo</label>
                <label
                  style={{
                    display: "inline-flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={!!eu.is_active}
                    onChange={onEditChange}
                  />
                  <span>{eu.is_active ? "Sí" : "No"}</span>
                </label>
              </div>
              <div className="au-field">
                <label className="au-label">Rol</label>
                <select
                  className="au-input"
                  name="role_code"
                  value={eu.role_code}
                  onChange={onEditChange}
                >
                  <option value="">(por defecto)</option>
                  {roleCatalog.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 12,
              }}
            >
              <button className="au-button" type="button" onClick={submitEdit}>
                Guardar
              </button>
              <button
                className="au-button au-button--ghost"
                type="button"
                onClick={() => setOpenEdit(false)}
                style={{ marginLeft: 8 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
