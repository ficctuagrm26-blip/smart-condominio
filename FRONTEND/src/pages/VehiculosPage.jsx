// src/pages/VehiculosPage.jsx
import { useEffect, useState } from "react";
import {
  listVehiculos,
  listSolicitudesVehiculo,
  createSolicitudVehiculo,
  VEHICULO_TIPO_CHOICES,
  cancelSolicitudVehiculo,
} from "../api/vehiculos";
import "./VehiculosPage.css";

const FORM_INIT = {
  placa: "",
  marca: "",
  modelo: "",
  color: "",
  tipo: "AUTO",
  foto_placa: null,
};

export default function VehiculosPage() {
  const [loading, setLoading] = useState(true);
  const [vehiculos, setVehiculos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState(FORM_INIT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [v, s] = await Promise.all([
        listVehiculos(),
        listSolicitudesVehiculo(),
      ]);
      setVehiculos(v);
      setSolicitudes(s);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createSolicitudVehiculo(form);
      setOpenForm(false);
      setForm(FORM_INIT);
      await load();
      alert("Solicitud enviada. Podrás ver el estado en la lista.");
    } catch (err) {
      const msg =
        err?.response?.data || err?.message || "Error creando la solicitud";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  }

  // Cancelar solicitud (solo si está PENDIENTE)
  async function handleCancelar(id) {
    const ok = confirm("¿Seguro que deseas cancelar esta solicitud?");
    if (!ok) return;
    try {
      await cancelSolicitudVehiculo(id);
      await load();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data || err?.message || "No se pudo cancelar";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  }

  return (
    <div className="vehiculos-page">
      <div className="au-toolbar">
        <button className="au-button" onClick={() => setOpenForm((v) => !v)}>
          {openForm ? "Cerrar formulario" : "Solicitar registro vehicular"}
        </button>
      </div>

      {openForm && (
        <form className="card vehiculo-form" onSubmit={handleSubmit}>
          <div className="vehiculo-form__header">
            <h2>Solicitud de registro de vehículo (CU25)</h2>
          </div>

          <div className="au-grid-3">
            <div className="au-field">
              <label className="au-label">Placa*</label>
              <input
                className="au-input"
                value={form.placa}
                onChange={(e) => updateField("placa", e.target.value)}
                required
                placeholder="ABC123"
              />
            </div>
            <div className="au-field">
              <label className="au-label">Marca</label>
              <input
                className="au-input"
                value={form.marca}
                onChange={(e) => updateField("marca", e.target.value)}
                placeholder="Toyota"
              />
            </div>
            <div className="au-field">
              <label className="au-label">Modelo</label>
              <input
                className="au-input"
                value={form.modelo}
                onChange={(e) => updateField("modelo", e.target.value)}
                placeholder="Corolla"
              />
            </div>
            <div className="au-field">
              <label className="au-label">Color</label>
              <input
                className="au-input"
                value={form.color}
                onChange={(e) => updateField("color", e.target.value)}
                placeholder="Plateado"
              />
            </div>
            <div className="au-field">
              <label className="au-label">Tipo</label>
              <select
                className="au-input"
                value={form.tipo}
                onChange={(e) => updateField("tipo", e.target.value)}
              >
                {VEHICULO_TIPO_CHOICES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="au-field">
              <label className="au-label">Foto</label>
              <input
                type="file"
                className="au-input"
                accept="image/*"
                onChange={(e) =>
                  updateField("foto", e.target.files?.[0] || null)
                }
              />
            </div>
            {/*<div className="au-field">
              <label className="au-label">Documento (PDF/imagen)</label>
              <input
                type="file"
                className="au-input"
                accept="image/*,application/pdf"
                onChange={(e) =>
                  updateField("documento", e.target.files?.[0] || null)
                }
              />
            </div>*/}
          </div>

          {error ? <p className="au-error">{error}</p> : null}
          <div className="vehiculo-form__footer">
            <button className="au-button" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar solicitud"}
            </button>
            <button
              type="button"
              className="au-button au-button--ghost"
              onClick={() => setOpenForm(false)}
              disabled={submitting}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <h2 className="card__title">Mis vehículos autorizados</h2>
        {loading ? (
          <p>Cargando...</p>
        ) : vehiculos.length === 0 ? (
          <p>No tienes vehículos autorizados.</p>
        ) : (
          <table className="au-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Color</th>
                <th>Tipo</th>
                <th>Autorizado en</th>
              </tr>
            </thead>
            <tbody>
              {vehiculos.map((v) => (
                <tr key={v.id}>
                  <td>{v.placa}</td>
                  <td>{v.marca || "-"}</td>
                  <td>{v.modelo || "-"}</td>
                  <td>{v.color || "-"}</td>
                  <td>{v.tipo}</td>
                  <td>
                    {v.autorizado_en
                      ? new Date(v.autorizado_en).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="card__title">Mis solicitudes</h2>
        {loading ? (
          <p>Cargando...</p>
        ) : solicitudes.length === 0 ? (
          <p>No registras solicitudes.</p>
        ) : (
          <table className="au-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Estado</th>
                <th>Revisado por</th>
                <th>Revisado en</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((s) => (
                <tr key={s.id}>
                  <td>{s.placa}</td>
                  <td>{s.marca || "-"}</td>
                  <td>{s.modelo || "-"}</td>
                  <td>
                    <span className={`chip chip--${s.estado?.toLowerCase()}`}>
                      {s.estado}
                    </span>
                  </td>
                  <td>{s.revisado_por || "-"}</td>
                  <td>
                    {s.revisado_en
                      ? new Date(s.revisado_en).toLocaleString()
                      : "-"}
                  </td>
                  <td>
                    {s.estado === "PENDIENTE" ? (
                      <button
                        className="au-button au-button--ghost"
                        onClick={() => handleCancelar(s.id)}
                      >
                        Cancelar
                      </button>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
