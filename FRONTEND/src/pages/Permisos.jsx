// src/pages/Permisos.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  listPermissions,
  getRolePermissions,
  addRolePermissions,
  removeRolePermissions,
  listRoles,
} from "../api/roles";
import "./Permisos.css";

export default function Permisos() {
  // ---- estado base ----
  const [roles, setRoles] = useState([]);
  const [roleId, setRoleId] = useState("");
  const [roleObj, setRoleObj] = useState(null);

  // ---- permisos ----
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState("");
  const [assigned, setAssigned] = useState([]);

  // ---- flags & errores ----
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState("");
  const [permError, setPermError] = useState("");
  const [mutatingId, setMutatingId] = useState(null);

  // 1) Cargar roles al entrar
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingRoles(true);
      setError("");
      try {
        const data = await listRoles();
        if (!alive) return;
        const items = data?.results ?? data ?? [];
        setRoles(items);
        if (items.length && !roleId) {
          const first = items[0];
          setRoleId(String(first.id));
          setRoleObj(first);
        }
      } catch (e) {
        if (alive) setError(parseErr(e));
      } finally {
        if (alive) setLoadingRoles(false);
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) Cargar permisos ASIGNADOS cuando cambia el rol
  useEffect(() => {
    if (!roleId) return;
    let alive = true;
    (async () => {
      setLoadingAssigned(true);
      setPermError("");
      try {
        const data = await getRolePermissions(roleId);
        if (!alive) return;
        setAssigned(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) setPermError(parseErr(e));
      } finally {
        if (alive) setLoadingAssigned(false);
      }
    })();
    return () => { alive = false; };
  }, [roleId]);

  // 3) Buscar en catálogo (debounce + abort)
  const tmr = useRef(null);
  const abortRef = useRef(null);
  useEffect(() => {
    let alive = true;
    if (tmr.current) clearTimeout(tmr.current);
    tmr.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoadingSearch(true);
      try {
        const data = await listPermissions(search, { signal: ctrl.signal });
        if (!alive) return;
        setCatalog(data?.results ?? []);
      } catch (e) {
        if (alive && e?.name !== "AbortError") setError(parseErr(e));
      } finally {
        if (alive) setLoadingSearch(false);
      }
    }, 250);
    return () => {
      alive = false;
      if (tmr.current) clearTimeout(tmr.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [search]);

  // ids asignados -> consulta O(1)
  const assignedIds = useMemo(() => new Set(assigned.map(p => p.id)), [assigned]);

  // 4) Acciones
  async function onAdd(p) {
    if (!roleId || !p) return;
    try {
      setMutatingId(p.id);
      await addRolePermissions(roleId, [p.id]);
      if (!assignedIds.has(p.id)) setAssigned(prev => [...prev, p]);
    } catch (e) {
      alert(parseErr(e));
    } finally {
      setMutatingId(null);
    }
  }
  async function onRemove(p) {
    if (!roleId || !p) return;
    try {
      setMutatingId(p.id);
      await removeRolePermissions(roleId, [p.id]);
      setAssigned(prev => prev.filter(x => x.id !== p.id));
    } catch (e) {
      alert(parseErr(e));
    } finally {
      setMutatingId(null);
    }
  }
  function onChangeRole(e) {
    const id = e.target.value;
    setRoleId(id);
    const r = roles.find(x => String(x.id) === String(id)) || null;
    setRoleObj(r);
  }

  // 5) Render
  return (
    <div className="permisos">
      {/* TOOLBAR */}
      <div className="card au-toolbar">
        <div className="au-toolbar__form">
          <h3 className="m-0">Permisos</h3>
          <div className="au-toolbar__spacer" />
          <div className="au-field min-260">
            <label className="au-label">Rol</label>
            <select
              className="au-input"
              value={roleId}
              onChange={onChangeRole}
              disabled={loadingRoles || roles.length === 0}
            >
              {roles.map(r => (
                <option key={r.id} value={r.id}>
                  {r.code}{r.name ? ` — ${r.name}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {/* CONTENT */}
      <div className="card grid-2 gap-16">
        {/* Catálogo */}
        <section>
          <div className="section-head">
            <label className="au-label">Buscar permisos</label>
            <input
              className="au-input"
              placeholder="user, pagos, avisos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {loadingSearch && <p className="muted mt-6">Buscando…</p>}
          </div>

          <div className="listbox">
            {catalog.map(p => {
              const isAssigned = assignedIds.has(p.id);
              const disabled = mutatingId === p.id;
              return (
                <div key={p.id} className="perm-row">
                  <div className="perm-code">
                    <code>{p.content_type}.{p.codename}</code>
                  </div>
                  <div className="perm-name">— {p.name}</div>
                  <div className="perm-actions">
                    {isAssigned ? (
                      <button
                        type="button"
                        className="au-button au-button--ghost"
                        onClick={() => onRemove(p)}
                        disabled={disabled}
                      >
                        Quitar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="au-button"
                        onClick={() => onAdd(p)}
                        disabled={disabled || !roleId}
                      >
                        Agregar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {catalog.length === 0 && !loadingSearch && (
              <p className="muted txt-center p-12">Sin resultados</p>
            )}
          </div>
        </section>

        {/* Asignados */}
        <section>
          <div className="section-head">
            <label className="au-label">Asignados {roleObj ? `— ${roleObj.code}` : ""}</label>
            {permError && <p className="error mt-6">{permError}</p>}
            {loadingAssigned && <p className="muted mt-6">Cargando…</p>}
          </div>

          <div className="listbox">
            {assigned.map(p => {
              const disabled = mutatingId === p.id;
              return (
                <div key={p.id} className="perm-row">
                  <div className="perm-code">
                    <code>{p.content_type}.{p.codename}</code>
                  </div>
                  <div className="perm-name">— {p.name}</div>
                  <div className="perm-actions">
                    <button
                      type="button"
                      className="au-button au-button--ghost"
                      onClick={() => onRemove(p)}
                      disabled={disabled}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              );
            })}
            {assigned.length === 0 && !loadingAssigned && (
              <p className="muted txt-center p-12">Este rol no tiene permisos asignados.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function parseErr(e) {
  if (!e) return "Error desconocido";
  if (typeof e === "string") return e;
  const d = e?.response?.data || e?.data || e;
  if (Array.isArray(d?.detail)) return d.detail.join(" ");
  if (d?.detail) return String(d.detail);
  try { return JSON.stringify(d); } catch { return "Error de red"; }
}
