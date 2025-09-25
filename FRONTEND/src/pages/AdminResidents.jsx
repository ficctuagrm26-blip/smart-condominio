// src/pages/AdminResidents.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { api } from "../api/auth";

const ROLE_OPTIONS_FALLBACK = [
  { code: "ADMIN", label: "Administrador" },
  { code: "STAFF", label: "Personal/Staff" },
  { code: "RESIDENT", label: "Residente" },
];

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
  if (Array.isArray(data.results))
    return {
      results: data.results,
      next: data.next || null,
      previous: data.previous || null,
      count: data.count ?? data.results.length,
    };
  if (Array.isArray(data))
    return { results: data, next: null, previous: null, count: data.length };
  const fa = Object.values(data).find(Array.isArray);
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

export default function AdminResidents() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState([]);
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(false);
  const [roleCatalog, setRoleCatalog] = useState(ROLE_OPTIONS_FALLBACK);

  const load = async (params = {}) => {
    setLoading(true);
    try {
      const r = await api.get("admin/users/", { params: { q, ...params } });
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

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [location.key]);

  const residents = useMemo(
    () => users.filter((u) => roleCodeOf(u) === "RESIDENT"),
    [users]
  );

  const onSearch = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (q) next.set("q", q);
    else next.delete("q");
    setSearchParams(next, { replace: true });
    load();
  };

  return (
    <div className="page">
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
            onClick={() => {
              setQ("");
              onSearch(new Event("submit"));
            }}
          >
            Limpiar
          </button>
        </form>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>Residentes</h3>
        <table className="au-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>Cargando…</td>
              </tr>
            )}
            {!loading && residents.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>
                  Sin residentes
                </td>
              </tr>
            )}
            {!loading &&
              residents.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{fullNameOf(u)}</td>
                  <td>{u.email || "—"}</td>
                  <td>{roleNameOf(u, roleCatalog)}</td>
                  <td>{u.is_active ? "Sí" : "No"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
