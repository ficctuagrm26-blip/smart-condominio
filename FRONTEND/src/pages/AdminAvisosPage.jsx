// src/pages/AdminAvisosPage.jsx
import { useEffect, useState } from "react";
import {
  listAvisos,
  createAviso,
  updateAviso,
  deleteAviso,
  publicarAviso,
  archivarAviso,
  listUnidades,
  listRoles,
} from "../api/avisos";

const INIT = {
  titulo: "",
  cuerpo: "",
  audiencia: "ALL", // ALL | TORRE | UNIDAD | ROL
  torre: "",
  unidades: [],
  roles: [],
  status: "BORRADOR", // BORRADOR | PROGRAMADO | PUBLICADO | ARCHIVADO
  publish_at: "",
  expires_at: "",
  notify_inapp: true,
  notify_email: false,
  notify_push: false,
  adjuntos: [], // arreglo de URLs
};

export default function AdminAvisosPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(INIT);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const [unidades, setUnidades] = useState([]);
  const [roles, setRolesState] = useState([]);

  const canTorre = form.audiencia === "TORRE";
  const canUnidad = form.audiencia === "UNIDAD";
  const canRol = form.audiencia === "ROL";

  const load = async () => {
    setLoading(true);
    try {
      const data = await listAvisos(
        q ? { search: q, ordering: "-publish_at" } : { ordering: "-publish_at" }
      );
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    listUnidades({ is_active: true, ordering: "torre" })
      .then((d) => setUnidades(Array.isArray(d) ? d : []))
      .catch(() => {});
    listRoles()
      .then((d) => setRolesState(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const onChangeMultiIDs = (name) => (e) => {
    const values = Array.from(e.target.selectedOptions).map((o) =>
      parseInt(o.value, 10)
    );
    setForm((f) => ({ ...f, [name]: values }));
  };

  const addAdjunto = () =>
    setForm((f) => ({ ...f, adjuntos: [...(f.adjuntos || []), ""] }));
  const changeAdjunto = (i, val) =>
    setForm((f) => {
      const a = [...(f.adjuntos || [])];
      a[i] = val;
      return { ...f, adjuntos: a };
    });
  const removeAdjunto = (i) =>
    setForm((f) => {
      const a = [...(f.adjuntos || [])];
      a.splice(i, 1);
      return { ...f, adjuntos: a };
    });

  const resetForm = () => {
    setForm(INIT);
    setEditingId(null);
    setError("");
  };

  const normalize = (p) => {
    const out = { ...p };
    if (!out.publish_at) out.publish_at = null;
    if (!out.expires_at) out.expires_at = null;

    if (out.audiencia !== "TORRE") out.torre = "";
    if (out.audiencia !== "UNIDAD") out.unidades = [];
    if (out.audiencia !== "ROL") out.roles = [];

    return out;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const payload = normalize(form);
    try {
      if (editingId) {
        await updateAviso(editingId, payload);
      } else {
        await createAviso(payload);
      }
      await load();
      resetForm();
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar. Revisa los campos obligatorios.");
    }
  };

  const onEdit = (it) => {
    setEditingId(it.id);
    setForm({
      titulo: it.titulo || "",
      cuerpo: it.cuerpo || "",
      audiencia: it.audiencia || "ALL",
      torre: it.torre || "",
      unidades: it.unidades || [],
      roles: it.roles || [],
      status: it.status || "BORRADOR",
      publish_at: it.publish_at ? it.publish_at.slice(0, 16) : "",
      expires_at: it.expires_at ? it.expires_at.slice(0, 16) : "",
      notify_inapp: !!it.notify_inapp,
      notify_email: !!it.notify_email,
      notify_push: !!it.notify_push,
      adjuntos: it.adjuntos || [],
    });
  };

  return (
    <div>
      <h2>Avisos y comunicados (Admin)</h2>

      {/* Toolbar búsqueda */}
      <div className="card au-toolbar">
        <form
          className="au-toolbar__form"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <div className="au-field">
            <label className="au-label">Búsqueda</label>
            <input
              className="au-input"
              placeholder="título, cuerpo..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="au-button">Buscar</button>
          <button
            type="button"
            className="au-button au-button--ghost"
            onClick={() => {
              setQ("");
              load();
            }}
          >
            Limpiar
          </button>
          <button
            type="button"
            className="au-button au-button--ghost"
            onClick={resetForm}
          >
            + Nuevo aviso
          </button>
        </form>
      </div>

      {/* Formulario */}
      <form className="card" onSubmit={onSubmit} style={{ marginBottom: 12 }}>
        {error && <p className="error">{error}</p>}

        <div className="au-field">
          <label className="au-label">Título</label>
          <input
            name="titulo"
            className="au-input"
            value={form.titulo}
            onChange={onChange}
            required
          />
        </div>

        <div className="au-field" style={{ marginTop: 10 }}>
          <label className="au-label">Cuerpo</label>
          <textarea
            name="cuerpo"
            className="au-input"
            value={form.cuerpo}
            onChange={onChange}
            required
          />
        </div>

        <div className="au-grid-3" style={{ marginTop: 10 }}>
          <div className="au-field">
            <label className="au-label">Audiencia</label>
            <select
              name="audiencia"
              className="au-input"
              value={form.audiencia}
              onChange={onChange}
            >
              <option value="ALL">Todos</option>
              <option value="TORRE">Por torre</option>
              <option value="UNIDAD">Por unidad</option>
              <option value="ROL">Por rol</option>
            </select>
          </div>

          {canTorre && (
            <div className="au-field">
              <label className="au-label">Torre</label>
              <input
                name="torre"
                className="au-input"
                placeholder="Ej: A"
                value={form.torre}
                onChange={onChange}
              />
            </div>
          )}

          {canUnidad && (
            <div className="au-field">
              <label className="au-label">Unidades</label>
              <select
                multiple
                className="au-input"
                value={form.unidades}
                onChange={onChangeMultiIDs("unidades")}
              >
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.torre}
                    {u.bloque ? `-${u.bloque}` : ""}-{u.numero}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canRol && (
            <div className="au-field">
              <label className="au-label">Roles</label>
              <select
                multiple
                className="au-input"
                value={form.roles}
                onChange={onChangeMultiIDs("roles")}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} - {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="au-grid-3" style={{ marginTop: 10 }}>
          <div className="au-field">
            <label className="au-label">Estado</label>
            <select
              name="status"
              className="au-input"
              value={form.status}
              onChange={onChange}
            >
              <option>BORRADOR</option>
              <option>PROGRAMADO</option>
              <option>PUBLICADO</option>
              <option>ARCHIVADO</option>
            </select>
          </div>

          <div className="au-field">
            <label className="au-label">Publicar en</label>
            <input
              type="datetime-local"
              name="publish_at"
              className="au-input"
              value={form.publish_at}
              onChange={onChange}
            />
          </div>

          <div className="au-field">
            <label className="au-label">Expira en</label>
            <input
              type="datetime-local"
              name="expires_at"
              className="au-input"
              value={form.expires_at}
              onChange={onChange}
            />
          </div>
        </div>

        <div className="au-grid-3" style={{ marginTop: 10 }}>
          <label className="au-checkbox">
            <input
              type="checkbox"
              name="notify_inapp"
              checked={form.notify_inapp}
              onChange={onChange}
            />
            Notif. in-app
          </label>
          <label className="au-checkbox">
            <input
              type="checkbox"
              name="notify_email"
              checked={form.notify_email}
              onChange={onChange}
            />
            Email
          </label>
          <label className="au-checkbox">
            <input
              type="checkbox"
              name="notify_push"
              checked={form.notify_push}
              onChange={onChange}
            />
            Push
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h4 style={{ margin: 0 }}>Adjuntos (URLs)</h4>
            <button
              type="button"
              className="au-button au-button--ghost"
              onClick={addAdjunto}
            >
              + Añadir URL
            </button>
          </div>
          {(form.adjuntos || []).map((url, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input
                className="au-input"
                placeholder="https://..."
                value={url}
                onChange={(e) => changeAdjunto(i, e.target.value)}
              />
              <button
                type="button"
                className="au-button au-button--ghost"
                onClick={() => removeAdjunto(i)}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="au-button">
            {editingId ? "Guardar cambios" : "Crear aviso"}
          </button>
          {editingId && (
            <button
              type="button"
              className="au-button au-button--ghost"
              onClick={resetForm}
              style={{ marginLeft: 8 }}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Listado */}
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="au-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Audiencia</th>
              <th>Programado</th>
              <th>Estado</th>
              <th>Adjuntos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7}>Cargando...</td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7}>Sin resultados.</td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.id}</td>
                <td>{it.titulo}</td>
                <td>
                  {it.audiencia}
                  {it.audiencia === "TORRE" && it.torre ? ` (${it.torre})` : ""}
                  {it.audiencia === "UNIDAD" && it.unidades?.length
                    ? ` (${it.unidades.length} uds.)`
                    : ""}
                  {it.audiencia === "ROL" && it.roles?.length
                    ? ` (${it.roles.length} roles)`
                    : ""}
                </td>
                <td>
                  {it.publish_at
                    ? new Date(it.publish_at).toLocaleString()
                    : "—"}
                </td>
                <td>{it.status}</td>
                <td>
                  {(it.adjuntos || []).length ? (
                    <a href={it.adjuntos[0]} target="_blank" rel="noreferrer">
                      Ver ({it.adjuntos.length})
                    </a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button
                    className="au-button au-button--ghost"
                    onClick={() => onEdit(it)}
                  >
                    Editar
                  </button>
                  <button
                    className="au-button au-button--ghost"
                    onClick={() => publicarAviso(it.id).then(load)}
                    disabled={it.status === "PUBLICADO"}
                  >
                    Publicar
                  </button>
                  <button
                    className="au-button au-button--ghost"
                    onClick={() => archivarAviso(it.id).then(load)}
                    disabled={it.status === "ARCHIVADO"}
                  >
                    Archivar
                  </button>
                  <button
                    className="au-button au-button--ghost"
                    onClick={async () => {
                      // eslint-disable-next-line no-restricted-globals
                      if (confirm("¿Eliminar aviso?")) {
                        await deleteAviso(it.id);
                        load();
                      }
                    }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
