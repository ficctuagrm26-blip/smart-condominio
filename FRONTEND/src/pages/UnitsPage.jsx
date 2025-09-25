// src/pages/UnitsPage.jsx
import { useEffect, useState } from "react";
import api from "../api/auth";

const TIPO_CHOICES = [
  { value: "DEP", label: "Departamento" },
  { value: "CASA", label: "Casa" },
  { value: "LOCAL", label: "Local" },
];

const ESTADO_CHOICES = [
  { value: "", label: "(todos)" },
  { value: "OCUPADA", label: "Ocupada" },
  { value: "DESOCUPADA", label: "Desocupada" },
  { value: "MANTENIMIENTO", label: "Mantenimiento" },
  { value: "INACTIVA", label: "Inactiva" },
];

const INIT = {
  // identificación
  torre: "",
  bloque: "",
  numero: "",
  piso: "",
  // características
  tipo: "DEP",
  metraje: "",
  coeficiente: "",
  dormitorios: 0,
  parqueos: 0,
  bodegas: 0,
  // estado/asignaciones
  estado: "DESOCUPADA",
  propietario: "",
  residente: "",
};

function toInt(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}
function toDec(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export default function UnitsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtros
  const [q, setQ] = useState("");
  const [fTorre, setFTorre] = useState("");
  const [fEstado, setFEstado] = useState("");

  // formulario
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState(INIT);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("unidades/", {
        params: {
          search: q || undefined, // por torre/bloque/numero
          torre: fTorre || undefined,
          estado: fEstado || undefined,
          ordering: "torre,bloque,numero",
        },
      });
      setItems(Array.isArray(data) ? data : data.results || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const resetForm = () => {
    setForm(INIT);
    setEditingId(null);
    setError("");
  };

  const openNew = () => {
    resetForm();
    setOpenForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    // normalizar payload
    const payload = {
      torre: form.torre || "",
      bloque: form.bloque || "",
      numero: form.numero || "",
      piso: toInt(form.piso),
      tipo: form.tipo || "DEP",
      metraje: toDec(form.metraje),
      coeficiente: toDec(form.coeficiente),
      dormitorios: toInt(form.dormitorios) ?? 0,
      parqueos: toInt(form.parqueos) ?? 0,
      bodegas: toInt(form.bodegas) ?? 0,
      estado: form.estado || "DESOCUPADA",
      propietario: form.propietario || null,
      residente: form.residente || null,
    };

    try {
      if (editingId) {
        await api.put(`unidades/${editingId}/`, payload);
      } else {
        await api.post("unidades/", payload);
      }
      await load();
      resetForm();
      setOpenForm(false);
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la unidad. Revisa los campos obligatorios.");
    }
  };

  const editRow = (u) => {
    setEditingId(u.id);
    setOpenForm(true);
    setForm({
      torre: u.torre ?? "",
      bloque: u.bloque ?? "",
      numero: u.numero ?? "",
      piso: u.piso ?? "",
      tipo: u.tipo ?? "DEP",
      metraje: u.metraje ?? "",
      coeficiente: u.coeficiente ?? "",
      dormitorios: u.dormitorios ?? 0,
      parqueos: u.parqueos ?? 0,
      bodegas: u.bodegas ?? 0,
      estado: u.estado ?? "DESOCUPADA",
      propietario: u.propietario ?? "",
      residente: u.residente ?? "",
    });
  };

  const desactivar = async (id) => {
    if (!confirm("¿Desactivar esta unidad?")) return; // eslint-disable-line no-restricted-globals
    await api.post(`unidades/${id}/desactivar/`);
    await load();
  };

  return (
    <div>
      <h2>Gestión de Unidades</h2>

      {/* Toolbar de filtro */}
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
              placeholder="torre/bloque/número…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="au-field" style={{ minWidth: 160 }}>
            <label className="au-label">Torre</label>
            <input
              className="au-input"
              value={fTorre}
              onChange={(e) => setFTorre(e.target.value)}
            />
          </div>

          <div className="au-field" style={{ minWidth: 180 }}>
            <label className="au-label">Estado</label>
            <select
              className="au-input"
              value={fEstado}
              onChange={(e) => setFEstado(e.target.value)}
            >
              {ESTADO_CHOICES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <button className="au-button">Buscar</button>
          <button
            type="button"
            className="au-button au-button--ghost"
            onClick={() => {
              setQ("");
              setFTorre("");
              setFEstado("");
              load();
            }}
          >
            Limpiar
          </button>
          <button
            type="button"
            className="au-button au-button--ghost"
            onClick={openNew}
          >
            + Nueva unidad
          </button>
        </form>
      </div>

      {/* Formulario (crear/editar) */}
      {openForm && (
        <form className="card" onSubmit={submit} style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>
            {editingId ? "Editar unidad" : "Nueva unidad"}
          </h3>
          {error && <p className="error">{error}</p>}

          <div className="au-grid-3">
            <div className="au-field">
              <label className="au-label">Torre</label>
              <input
                name="torre"
                className="au-input"
                value={form.torre}
                onChange={onChange}
                required
              />
            </div>
            <div className="au-field">
              <label className="au-label">Bloque</label>
              <input
                name="bloque"
                className="au-input"
                value={form.bloque}
                onChange={onChange}
              />
            </div>
            <div className="au-field">
              <label className="au-label">Número</label>
              <input
                name="numero"
                className="au-input"
                value={form.numero}
                onChange={onChange}
                required
              />
            </div>
          </div>

          <div className="au-grid-3">
            <div className="au-field">
              <label className="au-label">Piso</label>
              <input
                name="piso"
                className="au-input"
                value={form.piso}
                onChange={onChange}
              />
            </div>
            <div className="au-field">
              <label className="au-label">Tipo</label>
              <select
                name="tipo"
                className="au-input"
                value={form.tipo}
                onChange={onChange}
              >
                {TIPO_CHOICES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="au-field">
              <label className="au-label">Estado</label>
              <select
                name="estado"
                className="au-input"
                value={form.estado}
                onChange={onChange}
              >
                {ESTADO_CHOICES.filter((x) => x.value !== "").map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="au-grid-3">
            <div className="au-field">
              <label className="au-label">Metraje (m²)</label>
              <input
                name="metraje"
                className="au-input"
                value={form.metraje}
                onChange={onChange}
                placeholder="ej. 75.5"
              />
            </div>
            <div className="au-field">
              <label className="au-label">Coeficiente (%)</label>
              <input
                name="coeficiente"
                className="au-input"
                value={form.coeficiente}
                onChange={onChange}
                placeholder="ej. 2.50"
              />
            </div>
            <div className="au-field">
              <label className="au-label">Dormitorios</label>
              <input
                name="dormitorios"
                className="au-input"
                value={form.dormitorios}
                onChange={onChange}
              />
            </div>
          </div>

          <div className="au-grid-3">
            <div className="au-field">
              <label className="au-label">Parqueos</label>
              <input
                name="parqueos"
                className="au-input"
                value={form.parqueos}
                onChange={onChange}
              />
            </div>
            <div className="au-field">
              <label className="au-label">Bodegas</label>
              <input
                name="bodegas"
                className="au-input"
                value={form.bodegas}
                onChange={onChange}
              />
            </div>
            <div className="au-field">
              <label className="au-label">P/Residente (id)</label>
              <input
                name="residente"
                className="au-input"
                value={form.residente}
                onChange={onChange}
                placeholder="ej. 5 o vacío"
              />
            </div>
          </div>

          <div className="au-grid-3">
            <div className="au-field">
              <label className="au-label">Propietario (id)</label>
              <input
                name="propietario"
                className="au-input"
                value={form.propietario}
                onChange={onChange}
                placeholder="ej. 2 o vacío"
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="au-button">
              {editingId ? "Guardar cambios" : "Crear unidad"}
            </button>
            <button
              type="button"
              className="au-button au-button--ghost"
              onClick={() => {
                resetForm();
                setOpenForm(false);
              }}
              style={{ marginLeft: 8 }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tabla */}
      <div className="card" style={{ marginTop: 12, overflowX: "auto" }}>
        <table className="au-table" style={{ minWidth: 880 }}>
          <thead>
            <tr>
              <th>Torre</th>
              <th>Bloque</th>
              <th>Número</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Propietario</th>
              <th>Residente</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8}>Cargando…</td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8}>Sin resultados.</td>
              </tr>
            )}
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.torre}</td>
                <td>{u.bloque || "—"}</td>
                <td>{u.numero}</td>
                <td>{u.tipo}</td>
                <td>{u.estado}</td>
                <td>{u.propietario ?? "—"}</td>
                <td>{u.residente ?? "—"}</td>
                <td className="au-actions">
                  <button
                    className="au-button au-button--ghost"
                    onClick={() => editRow(u)}
                  >
                    Editar
                  </button>
                  <button
                    className="au-button au-button--ghost"
                    onClick={() => desactivar(u.id)}
                    disabled={u.estado === "INACTIVA"}
                  >
                    Desactivar
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
