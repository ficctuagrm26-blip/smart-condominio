// src/pages/UnitsPage.jsx
import { useEffect, useState } from "react";
import api from "../api/auth";
import "./UnitsPage.css";

// ---------- Catálogos ----------
const TIPO_CHOICES = [
  { value: "DEP", label: "Departamento" },
  { value: "CASA", label: "Casa" },
  { value: "LOCAL", label: "Local" },
];

const ESTADO_FILTER = [
  { value: "", label: "(todos)" },
  { value: "OCUPADA", label: "Ocupada" },
  { value: "DESOCUPADA", label: "Desocupada" },
  { value: "MANTENIMIENTO", label: "Mantenimiento" },
  { value: "INACTIVA", label: "Inactiva" },
];

const ESTADO_FORM = ESTADO_FILTER.filter((x) => x.value !== "");

// ---------- Helpers ----------
const INIT = {
  manzana: "",
  lote: "",
  numero: "",
  piso: "",
  tipo: "CASA",
  metraje: "",
  coeficiente: "",
  dormitorios: 0,
  parqueos: 0,
  bodegas: 0,
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
function getRoleCode(u) {
  const c =
    u?.profile?.role?.code ??
    u?.profile?.role_code ??
    u?.role_code ??
    u?.role ??
    "";
  return String(c).toUpperCase();
}

function filterByRole(rows, allowedCodes) {
  return rows.filter((u) => {
    const code = getRoleCode(u);
    const isStaff = !!u.is_staff || !!u?.profile?.is_staff;
    const isSuper = !!u.is_superuser;
    return !isStaff && !isSuper && allowedCodes.includes(code);
  });
}
// Normaliza usuarios a {id, name, email}
function mapUsers(rows) {
  return rows.map((u) => ({
    id: u.id,
    name:
      u.get_full_name ||
      u.full_name ||
      [u.first_name, u.last_name].filter(Boolean).join(" ") ||
      u.username ||
      `Usuario ${u.id}`,
    email: u.email || "",
  }));
}

export default function UnitsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtros
  const [q, setQ] = useState("");
  const [fManzana, setFManzana] = useState("");
  const [fEstado, setFEstado] = useState("");

  // formulario
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState(INIT);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  // combos de personas
  const [owners, setOwners] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(false);

  // ---------- Carga tabla ----------
  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("unidades/", {
        params: {
          search: q || undefined,
          manzana: fManzana || undefined,
          estado: fEstado || undefined,
          ordering: "manzana,lote,numero",
        },
      });
      setItems(Array.isArray(data) ? data : data.results || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Carga combos (cuando abres el form) ----------
  useEffect(() => {
  if (!openForm) return;
  (async () => {
    try {
      setLoadingPeople(true);

      // Trae usuarios (usa tu endpoint real)
      const [oRes, rRes] = await Promise.all([
        api.get("admin/users/", {
          params: {
            // si tu backend no filtra por role, igual filtramos acá
            is_active: true,
            ordering: "first_name,last_name",
            page_size: 1000,
          },
        }),
        api.get("admin/users/", {
          params: {
            is_active: true,
            ordering: "first_name,last_name",
            page_size: 1000,
          },
        }),
      ]);

      const ownersRaw = Array.isArray(oRes.data) ? oRes.data : oRes.data.results || [];
      const residentsRaw = Array.isArray(rRes.data) ? rRes.data : rRes.data.results || [];

      // QUEDARTE SOLO CON LOS QUE CORRESPONDEN
      const ownersOnly    = filterByRole(ownersRaw,   ["RESIDENT", "ADMIN"]);
      const residentsOnly = filterByRole(residentsRaw,["RESIDENT"]);

      setOwners(mapUsers(ownersOnly));
      setResidents(mapUsers(residentsOnly));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPeople(false);
    }
  })();
}, [openForm]);

  // ---------- Handlers ----------
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

    const payload = {
      manzana: form.manzana || "",
      lote: form.lote || "",
      numero: form.numero || "",
      piso: toInt(form.piso),
      tipo: form.tipo || "CASA",
      metraje: toDec(form.metraje),
      coeficiente: toDec(form.coeficiente),
      dormitorios: toInt(form.dormitorios) ?? 0,
      parqueos: toInt(form.parqueos) ?? 0,
      bodegas: toInt(form.bodegas) ?? 0,
      estado: form.estado || "DESOCUPADA",
      propietario: form.propietario ? toInt(form.propietario) : null,
      residente: form.residente ? toInt(form.residente) : null,
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
      manzana: u.manzana ?? "",
      lote: u.lote ?? "",
      numero: u.numero ?? "",
      piso: u.piso ?? "",
      tipo: u.tipo ?? "CASA",
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

  const showPiso = form.tipo !== "CASA";

  // ---------- Render ----------
  return (
    <div className="units-page">
      <h2>Gestión de Unidades</h2>

      {/* Toolbar */}
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
              placeholder="manzana/lote/número…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="au-field" style={{ minWidth: 160 }}>
            <label className="au-label">Manzana</label>
            <input
              className="au-input"
              value={fManzana}
              onChange={(e) => setFManzana(e.target.value)}
            />
          </div>

          <div className="au-field" style={{ minWidth: 180 }}>
            <label className="au-label">Estado</label>
            <select
              className="au-input"
              value={fEstado}
              onChange={(e) => setFEstado(e.target.value)}
            >
              {ESTADO_FILTER.map((o) => (
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
              setFManzana("");
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

      {/* Formulario */}
      {openForm && (
        <form className="card unit-form" onSubmit={submit}>
          <div className="unit-form__header">
            <h3>{editingId ? "Editar unidad" : "Nueva unidad"}</h3>
            <div className="unit-form__header-actions">
              <button
                type="button"
                className="au-button au-button--ghost"
                onClick={() => {
                  resetForm();
                  setOpenForm(false);
                }}
              >
                Cerrar
              </button>
            </div>
          </div>

          {error && <p className="error">{error}</p>}

          <div className="au-grid-3">
            <div className="au-field">
              <label className="au-label">Manzana</label>
              <input
                name="manzana"
                className="au-input"
                value={form.manzana}
                onChange={onChange}
                required
              />
            </div>
            <div className="au-field">
              <label className="au-label">Lote (opcional)</label>
              <input
                name="lote"
                className="au-input"
                value={form.lote}
                onChange={onChange}
              />
            </div>
            <div className="au-field">
              <label className="au-label">N° Casa / Dpto / Local</label>
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
            {showPiso ? (
              <div className="au-field">
                <label className="au-label">Piso</label>
                <input
                  name="piso"
                  type="number"
                  inputMode="numeric"
                  className="au-input"
                  value={form.piso}
                  onChange={onChange}
                />
              </div>
            ) : (
              <div className="au-field" />
            )}

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
                {ESTADO_FORM.map((o) => (
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
                type="number"
                step="0.01"
                inputMode="decimal"
                className="au-input"
                value={form.metraje}
                onChange={onChange}
                placeholder="ej. 120.5"
              />
            </div>
            <div className="au-field">
              <label className="au-label">Coeficiente (%)</label>
              <input
                name="coeficiente"
                type="number"
                step="0.0001"
                inputMode="decimal"
                className="au-input"
                value={form.coeficiente}
                onChange={onChange}
                placeholder="ej. 2.5000"
              />
            </div>
            <div className="au-field">
              <label className="au-label">Dormitorios</label>
              <input
                name="dormitorios"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
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
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                className="au-input"
                value={form.parqueos}
                onChange={onChange}
              />
            </div>
            <div className="au-field">
              <label className="au-label">Bodegas</label>
              <input
                name="bodegas"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                className="au-input"
                value={form.bodegas}
                onChange={onChange}
              />
            </div>

            {/* Residente: SELECT */}
            <div className="au-field">
              <label className="au-label">Residente</label>
              <select
                name="residente"
                className="au-input"
                value={form.residente}
                onChange={onChange}
                disabled={loadingPeople}
              >
                <option value="">(sin residente)</option>
                {residents.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.email ? `— ${u.email}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="au-grid-3">
            {/* Propietario: SELECT */}
            <div className="au-field">
              <label className="au-label">Propietario</label>
              <select
                name="propietario"
                className="au-input"
                value={form.propietario}
                onChange={onChange}
                disabled={loadingPeople}
              >
                <option value="">(sin propietario)</option>
                {owners.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.email ? `— ${u.email}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="unit-form__footer">
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
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tabla */}
      <div className="card" style={{ marginTop: 12, overflowX: "auto" }}>
        <table className="au-table au-table--compact" style={{ minWidth: 880 }}>
          <thead>
            <tr>
              <th className="col--sm">Manzana</th>
              <th className="col--sm">Lote</th>
              <th className="col--sm">Número</th>
              <th className="col--md">Tipo</th>
              <th className="col--md">Estado</th>
              <th className="col--lg">Propietario</th>
              <th className="col--lg">Residente</th>
              <th className="col--actions"></th>
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
                <td>{u.manzana}</td>
                <td>{u.lote || "—"}</td>
                <td>{u.numero}</td>
                <td>{u.tipo}</td>
                <td>
                  <span className={`badge badge--${(u.estado || "").toLowerCase()}`}>
                    {u.estado}
                  </span>
                </td>
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
                    title={
                      u.estado === "INACTIVA"
                        ? "Ya está inactiva"
                        : "Desactivar unidad"
                    }
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
