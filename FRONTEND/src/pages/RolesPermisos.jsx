// src/pages/RolesPermisos.jsx
import { useEffect, useState } from "react";
import { listRoles, getRolePermissions } from "../api/roles";
import PermissionEditor from "../components/PermissionEditor";

export default function RolesPermisos() {
  const [page, setPage] = useState(null); // {count,next,previous,results}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // { id, name }

  async function load(url) {
    try {
      setLoading(true);
      setError("");
      const data = await listRoles(url);
      // Normaliza a {results: [...]} si viene plano
      const results = Array.isArray(data) ? data : data?.results || [];
      setPage({ ...data, results });
    } catch (e) {
      console.error(e);
      setError(parseErr(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // (Opcional) contar permisos del rol cuando abres el modal; aquí dejamos solo el botón
  // Si quieres mostrar contador en tabla, puedes precargar con getRolePermissions(r.id).length por cada fila (más requests)

  return (
    <div>
      {/* Encabezado */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Roles & Permisos</h2>
        <p className="au-muted">
          Administra permisos por rol desde una sola vista.
        </p>
      </div>

      {/* Tabla */}
      <div className="card">
        {loading && <p>Cargando…</p>}
        {error && <p className="error">{error}</p>}
        {page && (
          <>
            <table className="au-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th style={{ width: 180 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {page.results.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.code || r.codigo || "-"}</td>
                    <td>{r.name || r.nombre}</td>
                    <td>
                      <button
                        className="au-button au-button--primary"
                        onClick={() =>
                          setEditing({ id: r.id, name: r.name || r.nombre })
                        }
                      >
                        Editar permisos
                      </button>
                    </td>
                  </tr>
                ))}
                {page.results.length === 0 && (
                  <tr>
                    <td colSpan={4} className="au-empty">
                      No hay roles.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Paginación si tu API la usa */}
            {(page.previous || page.next) && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  className="au-button"
                  disabled={!page.previous}
                  onClick={() => load(page.previous)}
                >
                  ◀ Anterior
                </button>
                <button
                  className="au-button"
                  disabled={!page.next}
                  onClick={() => load(page.next)}
                >
                  Siguiente ▶
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de edición */}
      {editing && (
        <PermissionEditor
          role={editing}
          onClose={() => setEditing(null)}
          afterSave={async () => {
            // Si quisieras actualizar contador, aquí podrías llamar a load()
          }}
        />
      )}
    </div>
  );
}

function parseErr(e) {
  if (!e) return "Error desconocido";
  if (typeof e === "string") return e;
  if (Array.isArray(e.detail)) return e.detail.join(" ");
  if (e.detail) return String(e.detail);
  try {
    return JSON.stringify(e);
  } catch {
    return "Error de red";
  }
}
