import { useEffect, useState } from "react";
import {
  listUnidades, createUnidad, updateUnidad,
  deleteUnidad, desactivarUnidad, asignarUnidad
} from "../api/unidades";

const empty = {
  torre: "", bloque: "", numero: "", piso: "",
  tipo: "DEP", metraje: "", coeficiente: "",
  dormitorios: 0, parqueos: 0, bodegas: 0,
  estado: "DESOCUPADA", propietario: null, residente: null, is_active: true
};

export default function UnitsPage() {
  const [items, setItems] = useState([]);
  const [pageInfo, setPageInfo] = useState({ next: null, previous: null, count: 0 });
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");               // search
  const [filters, setFilters] = useState({ estado: "", torre: "" });
  const [editing, setEditing] = useState(null); // objeto unidad o null
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  async function load(params = {}) {
    setLoading(true);
    try {
      const data = await listUnidades({
        search: q || undefined,
        estado: filters.estado || undefined,
        torre: filters.torre || undefined,
        ordering: "-updated_at",
        ...params,
      });
      const results = Array.isArray(data) ? data : data.results;
      setItems(results);
      if (!Array.isArray(data)) setPageInfo({ next: data.next, previous: data.previous, count: data.count });
      else setPageInfo({ next: null, previous: null, count: results.length });
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // inicial

  function msg(e) {
    if (e?.response?.data) {
      try { return JSON.stringify(e.response.data); } catch { return "Error"; }
    }
    return e?.message || "Error";
  }

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value === "" ? "" : value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(empty);
  }

  function openEdit(u) {
    setEditing(u);
    setForm({
      ...empty,
      ...u,
      // FKs vienen como id numérico (DRF); si vinieran anidados, mapeas a id aquí
      propietario: u.propietario ?? null,
      residente: u.residente ?? null,
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      // normaliza numéricos
      const payload = {
        ...form,
        piso: form.piso === "" ? null : Number(form.piso),
        metraje: form.metraje === "" ? null : String(form.metraje),
        coeficiente: form.coeficiente === "" ? null : String(form.coeficiente),
        dormitorios: Number(form.dormitorios || 0),
        parqueos: Number(form.parqueos || 0),
        bodegas: Number(form.bodegas || 0),
        propietario: form.propietario === "" ? null : (form.propietario ?? null),
        residente: form.residente === "" ? null : (form.residente ?? null),
      };
      if (editing) await updateUnidad(editing.id, payload);
      else await createUnidad(payload);
      openCreate();
      await load();
    } catch (e2) {
      setError(msg(e2));
    }
  }

  async function onDelete(id) {
    if (!confirm("¿Eliminar esta unidad?")) return;
    try { await deleteUnidad(id); await load(); } catch (e) { alert(msg(e)); }
  }

  async function onDesactivar(id) {
    if (!confirm("¿Desactivar esta unidad?")) return;
    try { await desactivarUnidad(id); await load(); } catch (e) { alert(msg(e)); }
  }

  return (
    <div>
      <h2>Gestión de Unidades</h2>

      {/* Toolbar: búsqueda y filtros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label>Búsqueda</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="torre/bloque/número..." />
          </div>
          <div>
            <label>Torre</label>
            <input value={filters.torre} onChange={(e) => setFilters((f) => ({ ...f, torre: e.target.value }))} />
          </div>
          <div>
            <label>Estado</label>
            <select value={filters.estado} onChange={(e) => setFilters((f) => ({ ...f, estado: e.target.value }))}>
              <option value="">(todos)</option>
              <option value="DESOCUPADA">DESOCUPADA</option>
              <option value="OCUPADA">OCUPADA</option>
              <option value="MANTENIMIENTO">MANTENIMIENTO</option>
              <option value="INACTIVA">INACTIVA</option>
            </select>
          </div>
          <button onClick={() => load()}>Buscar</button>
          <button onClick={() => { setQ(""); setFilters({ estado: "", torre: "" }); load(); }}>Limpiar</button>
          <div style={{ flex: 1 }} />
          <button onClick={openCreate}>+ Nueva unidad</button>
        </div>
      </div>

      {/* Formulario */}
      <form className="card" onSubmit={onSubmit} style={{ marginBottom: 16 }}>
        <h3>{editing ? "Editar unidad" : "Nueva unidad"}</h3>
        {error && <p className="error">{error}</p>}

        <div className="au-form__grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <div><label>Torre</label><input name="torre" value={form.torre} onChange={onChange} required /></div>
          <div><label>Bloque</label><input name="bloque" value={form.bloque} onChange={onChange} /></div>
          <div><label>Número</label><input name="numero" value={form.numero} onChange={onChange} required /></div>

          <div><label>Piso</label><input name="piso" type="number" value={form.piso} onChange={onChange} /></div>
          <div>
            <label>Tipo</label>
            <select name="tipo" value={form.tipo} onChange={onChange}>
              <option value="DEP">Departamento</option>
              <option value="CASA">Casa</option>
              <option value="LOCAL">Local</option>
            </select>
          </div>
          <div><label>Metraje (m²)</label><input name="metraje" value={form.metraje} onChange={onChange} /></div>

          <div><label>Coeficiente (%)</label><input name="coeficiente" value={form.coeficiente} onChange={onChange} /></div>
          <div><label>Dormitorios</label><input name="dormitorios" type="number" value={form.dormitorios} onChange={onChange} /></div>
          <div><label>Parqueos</label><input name="parqueos" type="number" value={form.parqueos} onChange={onChange} /></div>

          <div><label>Bodegas</label><input name="bodegas" type="number" value={form.bodegas} onChange={onChange} /></div>
          <div>
            <label>Estado</label>
            <select name="estado" value={form.estado} onChange={onChange}>
              <option value="DESOCUPADA">DESOCUPADA</option>
              <option value="OCUPADA">OCUPADA</option>
              <option value="MANTENIMIENTO">MANTENIMIENTO</option>
              <option value="INACTIVA">INACTIVA</option>
            </select>
          </div>

          {/* FKs: ingresa IDs de usuario por ahora (luego puedes reemplazar por autocompletes) */}
          <div><label>Propietario (id)</label><input name="propietario" value={form.propietario ?? ""} onChange={onChange} placeholder="ej. 2 o vacío" /></div>
          <div><label>Residente (id)</label><input name="residente" value={form.residente ?? ""} onChange={onChange} placeholder="ej. 5 o vacío" /></div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button type="submit">{editing ? "Guardar cambios" : "Crear unidad"}</button>
          {editing && (
            <>
              <button type="button" onClick={() => onDesactivar(editing.id)}>Desactivar</button>
              <button type="button" onClick={() => onDelete(editing.id)} className="danger">Eliminar</button>
              <button type="button" onClick={openCreate}>Cancelar</button>
            </>
          )}
        </div>
      </form>

      {/* Tabla */}
      <div className="card">
        <table className="au-table">
          <thead>
            <tr>
              <th>Torre</th><th>Bloque</th><th>Número</th><th>Tipo</th><th>Estado</th>
              <th>Propietario</th><th>Residente</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8}>Sin resultados</td></tr>
            ) : items.map(u => (
              <tr key={u.id}>
                <td>{u.torre}</td>
                <td>{u.bloque || "-"}</td>
                <td>{u.numero}</td>
                <td>{u.tipo}</td>
                <td>{u.estado}</td>
                <td>{u.propietario ?? "-"}</td>
                <td>{u.residente ?? "-"}</td>
                <td style={{ textAlign: "right" }}>
                  <button onClick={() => openEdit(u)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Paginación DRF, si aplica */}
        {(pageInfo.previous || pageInfo.next) && (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: 8 }}>
            <button disabled={!pageInfo.previous} onClick={() => load({ page: getPage(pageInfo.previous) })}>← Anterior</button>
            <button disabled={!pageInfo.next} onClick={() => load({ page: getPage(pageInfo.next) })}>Siguiente →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function getPage(url) {
  try { return new URL(url).searchParams.get("page"); } catch { return undefined; }
}
