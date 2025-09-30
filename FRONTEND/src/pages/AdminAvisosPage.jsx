// src/pages/AdminAvisosPage.jsx
import { useEffect, useMemo, useState } from "react";
import {
  listAvisos, createAviso, updateAviso, deleteAviso, publicarAviso, archivarAviso,
} from "../api/avisos";
import AvisoCard from "../components/AvisoCard";
import "./AdminAvisosPage.css"; // 👈 importa tu css chido

const INIT = {
  titulo: "",
  cuerpo: "",
  status: "BORRADOR",
  publish_at: "",
  expires_at: "",
};

export default function AdminAvisosPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(INIT);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await listAvisos(q ? { search: q, ordering: "-created_at" } : { ordering: "-created_at" });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const previewAviso = useMemo(() => {
    const toISO = (v) => (v ? new Date(v).toISOString() : null);
    return {
      id: editingId || "—",
      titulo: form.titulo || "(sin título)",
      cuerpo: form.cuerpo || "(sin contenido)",
      status: form.status || "BORRADOR",
      publish_at: toISO(form.publish_at),
      expires_at: toISO(form.expires_at),
      created_at: new Date().toISOString(),
      created_by: "tú",
    };
  }, [form, editingId]);

  const normalize = (p) => {
    const out = { ...p };
    const toISO = (v) => (v ? new Date(v).toISOString() : null);
    out.publish_at = toISO(out.publish_at);
    out.expires_at = toISO(out.expires_at);
    return out;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const payload = normalize(form);
      if (editingId) await updateAviso(editingId, payload);
      else await createAviso(payload);
      await load();
      resetForm();
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar. Verifica títulos, fechas y estado.");
    }
  };

  const onEdit = (it) => {
    setEditingId(it.id);
    setForm({
      titulo: it.titulo || "",
      cuerpo: it.cuerpo || "",
      status: it.status || "BORRADOR",
      publish_at: it.publish_at ? it.publish_at.slice(0, 16) : "",
      expires_at: it.expires_at ? it.expires_at.slice(0, 16) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setForm(INIT);
    setEditingId(null);
    setError("");
  };

  return (
    <div className="page admin-avisos">{/* 👈 scope de estilos */}
      <h2 className="page__title">Avisos y comunicados (Admin)</h2>

      {/* Toolbar */}
      <div className="card toolbar">
        <form className="toolbar__form" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input className="input" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn">Buscar</button>
          <button type="button" className="btn btn--ghost" onClick={() => { setQ(""); load(); }}>
            Limpiar
          </button>
          <button type="button" className="btn btn--ghost" onClick={resetForm}>
            + Nuevo
          </button>
        </form>
      </div>

      {/* Editor + Preview */}
      <div className="grid-2">
        <form className="card form" onSubmit={onSubmit}>
          <h3 className="card__title">{editingId ? `Editar aviso #${editingId}` : "Crear aviso"}</h3>
          {error && <p className="error">{error}</p>}

          <label className="label">Título</label>
          <input name="titulo" className="input" value={form.titulo} onChange={onChange} maxLength={200} required />

          <label className="label">Contenido</label>
          <textarea name="cuerpo" className="input" value={form.cuerpo} onChange={onChange} rows={6} required />

          <div className="grid-3">
            <div>
              <label className="label">Estado</label>
              <select name="status" className="input" value={form.status} onChange={onChange}>
                <option>BORRADOR</option>
                <option>PUBLICADO</option>
                <option>ARCHIVADO</option>
              </select>
            </div>
            <div>
              <label className="label">Publicar en</label>
              <input type="datetime-local" name="publish_at" className="input" value={form.publish_at} onChange={onChange} />
            </div>
            <div>
              <label className="label">Expira en</label>
              <input type="datetime-local" name="expires_at" className="input" value={form.expires_at} onChange={onChange} />
            </div>
          </div>

          <div className="form__actions">
            <button className="btn">{editingId ? "Guardar cambios" : "Crear aviso"}</button>
            {editingId && <button type="button" className="btn btn--ghost" onClick={resetForm}>Cancelar</button>}
          </div>
        </form>

        <div className="card">
          <h3 className="card__title">Vista previa</h3>
          <AvisoCard aviso={previewAviso} />
        </div>
      </div>

      {/* Listado */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="card__title">Publicaciones</h3>
        {loading && <div className="empty">Cargando…</div>}
        {!loading && items.length === 0 && <div className="empty">No hay avisos.</div>}

        <div className="feed">
          {items.map((it) => (
            <AvisoCard
              key={it.id}
              aviso={it}
              compact
              onEdit={onEdit}
              onPublish={async (a) => { await publicarAviso(a.id); load(); }}
              onArchive={async (a) => { await archivarAviso(a.id); load(); }}
              onDelete={async (a) => { await deleteAviso(a.id); load(); }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
