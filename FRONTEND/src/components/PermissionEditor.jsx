// src/components/PermissionEditor.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  listPermissions,
  getRolePermissions,
  addRolePermissions,
  removeRolePermissions,
} from "../api/roles";

export default function PermissionEditor({ role, onClose, afterSave }) {
  // estado
  const [assigned, setAssigned] = useState([]); // permisos ya asignados (array objetos)
  const [catalog, setCatalog] = useState([]); // resultados de búsqueda
  const [loadingAssigned, setLoadingAssigned] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [mutatingId, setMutatingId] = useState(null);
  const [q, setQ] = useState("");

  // cargar permisos del rol
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingAssigned(true);
      try {
        const data = await getRolePermissions(role.id);
        if (!alive) return;
        setAssigned(Array.isArray(data) ? data : []);
      } finally {
        if (alive) setLoadingAssigned(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [role.id]);

  // buscar en el catálogo con debounce + abort
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
        const data = await listPermissions(q);
        if (!alive) return;
        const items = data?.results ?? data ?? [];
        setCatalog(items);
      } finally {
        if (alive) setLoadingSearch(false);
      }
    }, 250);
    return () => {
      alive = false;
    };
  }, [q]);

  const assignedIds = useMemo(
    () => new Set(assigned.map((p) => p.id)),
    [assigned]
  );

  // Agrupar por módulo (content_type)
  const groupsAssigned = useMemo(() => groupByModule(assigned), [assigned]);
  const groupsCatalog = useMemo(() => groupByModule(catalog), [catalog]);

  async function onAdd(p) {
    if (!p || assignedIds.has(p.id)) return;
    setMutatingId(p.id);
    try {
      await addRolePermissions(role.id, [p.id]);
      setAssigned((prev) => [...prev, p]);
    } finally {
      setMutatingId(null);
    }
  }

  async function onRemove(p) {
    if (!p || !assignedIds.has(p.id)) return;
    setMutatingId(p.id);
    try {
      await removeRolePermissions(role.id, [p.id]);
      setAssigned((prev) => prev.filter((x) => x.id !== p.id));
    } finally {
      setMutatingId(null);
    }
  }

  // marcar/limpiar módulo completo
  async function addModule(mod) {
    const toAdd = (groupsCatalog[mod] || []).filter(
      (p) => !assignedIds.has(p.id)
    );
    if (!toAdd.length) return;
    setMutatingId(-1);
    try {
      await addRolePermissions(
        role.id,
        toAdd.map((p) => p.id)
      );
      setAssigned((prev) => [...prev, ...toAdd]);
    } finally {
      setMutatingId(null);
    }
  }
  async function clearModule(mod) {
    const toRemove = groupsAssigned[mod] || [];
    if (!toRemove.length) return;
    setMutatingId(-2);
    try {
      await removeRolePermissions(
        role.id,
        toRemove.map((p) => p.id)
      );
      setAssigned((prev) => prev.filter((x) => x.content_type !== mod));
    } finally {
      setMutatingId(null);
    }
  }

  const assignedTotal = assigned.length;

  return (
    <div className="au-modal">
      <div className="au-modal__backdrop" onClick={onClose} />
      <div className="au-modal__panel card">
        <div className="au-modal__header">
          <h3 style={{ margin: 0 }}>
            Editar permisos – <strong>{role.name}</strong>
          </h3>
          <button className="au-button au-button--ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {/* Buscador */}
        <div className="au-toolbar" style={{ marginBottom: 12 }}>
          <input
            className="au-input"
            placeholder="Buscar permiso (codename, nombre)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="au-chip">{assignedTotal} asignados</span>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {/* Columna izquierda: catálogo */}
          <div>
            <h4 style={{ margin: 0, marginBottom: 8 }}>Catálogo</h4>
            {loadingSearch && <p style={{ opacity: 0.8 }}>Buscando…</p>}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 8,
                maxHeight: 420,
                overflow: "auto",
              }}
            >
              {Object.entries(groupsCatalog).map(([mod, items]) => (
                <div key={mod} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <strong>{mod}</strong>
                    <span className="au-chip">{items.length}</span>
                    <div style={{ marginLeft: "auto" }}>
                      <button
                        className="au-link"
                        onClick={() => addModule(mod)}
                      >
                        Marcar todo
                      </button>
                    </div>
                  </div>
                  {items.map((p) => {
                    const isAssigned = assignedIds.has(p.id);
                    const disabled = mutatingId === p.id;
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 0",
                        }}
                      >
                        <div style={{ fontFamily: "monospace" }}>
                          {p.content_type}.{p.codename}
                        </div>
                        <div style={{ color: "#aab2c5" }}>— {p.name}</div>
                        <div style={{ marginLeft: "auto" }}>
                          <button
                            type="button"
                            className="au-button au-button--ghost"
                            onClick={() => onAdd(p)}
                            disabled={isAssigned || disabled}
                          >
                            {isAssigned ? "Asignado" : "Agregar"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              {Object.keys(groupsCatalog).length === 0 && !loadingSearch && (
                <p style={{ opacity: 0.75 }}>Sin resultados.</p>
              )}
            </div>
          </div>

          {/* Columna derecha: asignados */}
          <div>
            <h4 style={{ margin: 0, marginBottom: 8 }}>Asignados</h4>
            {loadingAssigned && <p style={{ opacity: 0.8 }}>Cargando…</p>}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 8,
                maxHeight: 420,
                overflow: "auto",
              }}
            >
              {Object.entries(groupsAssigned).map(([mod, items]) => (
                <div key={mod} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <strong>{mod}</strong>
                    <span className="au-chip">{items.length}</span>
                    <div style={{ marginLeft: "auto" }}>
                      <button
                        className="au-link"
                        onClick={() => clearModule(mod)}
                      >
                        Limpiar módulo
                      </button>
                    </div>
                  </div>
                  {items.map((p) => {
                    const disabled = mutatingId === p.id;
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 0",
                        }}
                      >
                        <div style={{ fontFamily: "monospace" }}>
                          {p.content_type}.{p.codename}
                        </div>
                        <div style={{ color: "#aab2c5" }}>— {p.name}</div>
                        <div style={{ marginLeft: "auto" }}>
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
                </div>
              ))}
              {assigned.length === 0 && !loadingAssigned && (
                <p style={{ opacity: 0.75 }}>
                  Este rol no tiene permisos asignados.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="au-modal__footer">
          <button
            className="au-button"
            onClick={async () => {
              await afterSave?.();
              onClose();
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function groupByModule(arr) {
  const map = {};
  (arr || []).forEach((p) => {
    const mod = p.content_type || "General";
    (map[mod] ||= []).push(p);
  });
  // ordena por codename para consistencia
  Object.values(map).forEach((list) =>
    list.sort((a, b) => a.codename.localeCompare(b.codename))
  );
  return map;
}
