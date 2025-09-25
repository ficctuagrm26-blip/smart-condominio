// src/pages/AdminAreaReglasPage.jsx
// CU19: Configurar disponibilidad, horarios y reglas de uso de áreas

import { useEffect, useMemo, useState } from "react";
import {
  listAreas,
  DIA_CHOICES,
  listReglas,
  createRegla,
  updateRegla,
  deleteRegla,
} from "../api/areas";

function timeOK(t) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(t || "");
}

export default function AdminAreaReglasPage() {
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState("");
  const [dia, setDia] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    dia_semana: "",
    hora_inicio: "",
    hora_fin: "",
    max_horas_por_reserva: 4,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const arr = await listAreas();
        setAreas(arr);
        if (arr.length && !areaId) setAreaId(arr[0].id);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReglas = async () => {
    if (!areaId) return;
    setLoading(true);
    setError("");
    try {
      const arr = await listReglas({
        area: areaId,
        ...(dia !== "" ? { dia_semana: dia } : {}),
      });
      const sorted = arr.slice().sort((a, b) => {
        if (a.dia_semana !== b.dia_semana) return a.dia_semana - b.dia_semana;
        return String(a.hora_inicio).localeCompare(String(b.hora_inicio));
      });
      setItems(sorted);
    } catch (e) {
      setError("No se pudieron cargar las reglas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReglas(); /* eslint-disable-next-line */
  }, [areaId, dia]);

  const resetForm = () => {
    setForm({
      dia_semana: "",
      hora_inicio: "",
      hora_fin: "",
      max_horas_por_reserva: 4,
    });
    setEditingId(null);
  };

  const valid = useMemo(() => {
    if (!areaId) return false;
    const d = form.dia_semana;
    if (d === "" || d === null || d === undefined) return false;
    if (!timeOK(form.hora_inicio) || !timeOK(form.hora_fin)) return false;
    const maxh = Number(form.max_horas_por_reserva);
    if (!Number.isFinite(maxh) || maxh <= 0) return false;
    return form.hora_fin > form.hora_inicio;
  }, [areaId, form]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        area: Number(areaId),
        dia_semana: Number(form.dia_semana),
        hora_inicio:
          form.hora_inicio.length === 5
            ? `${form.hora_inicio}:00`
            : form.hora_inicio,
        hora_fin:
          form.hora_fin.length === 5 ? `${form.hora_fin}:00` : form.hora_fin,
        max_horas_por_reserva: Number(form.max_horas_por_reserva),
      };
      if (editingId) await updateRegla(editingId, payload);
      else await createRegla(payload);
      resetForm();
      await loadReglas();
    } catch (e2) {
      setError(e2?.response?.data?.detail || "Error al guardar la regla.");
    } finally {
      setLoading(false);
    }
  };

  const onEdit = (r) => {
    setEditingId(r.id);
    setForm({
      dia_semana: r.dia_semana,
      hora_inicio: String(r.hora_inicio || "").slice(0, 5),
      hora_fin: String(r.hora_fin || "").slice(0, 5),
      max_horas_por_reserva: r.max_horas_por_reserva ?? 4,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta regla?")) return;
    setLoading(true);
    setError("");
    try {
      await deleteRegla(id);
      await loadReglas();
    } catch (e) {
      setError(e?.response?.data?.detail || "No se pudo eliminar la regla.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 1100 }}>
      <h2 style={{ marginBottom: 12 }}>
        Reglas de disponibilidad (Áreas comunes)
      </h2>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div
          className="au-form__grid"
          style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
        >
          <div className="au-field">
            <label className="au-label">Área</label>
            <select
              className="au-input"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
            >
              <option value="" disabled>
                Seleccione...
              </option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="au-field">
            <label className="au-label">Día (filtro)</label>
            <select
              className="au-input"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            >
              <option value="">Todos</option>
              {DIA_CHOICES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="au-field" style={{ alignSelf: "end" }}>
            <button
              className="au-button au-button--ghost"
              onClick={loadReglas}
              disabled={!areaId || loading}
            >
              Refrescar
            </button>
          </div>
        </div>
      </div>

      {/* Form Alta/Edición */}
      <form
        className="au-form"
        onSubmit={onSubmit}
        style={{ marginBottom: 16 }}
      >
        <div
          className="au-form__grid"
          style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}
        >
          <div className="au-field">
            <label className="au-label">Día</label>
            <select
              className="au-input"
              value={form.dia_semana}
              onChange={(e) => setForm({ ...form, dia_semana: e.target.value })}
              required
            >
              <option value="" disabled>
                Seleccione...
              </option>
              {DIA_CHOICES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="au-field">
            <label className="au-label">Hora inicio</label>
            <input
              className="au-input"
              type="time"
              value={form.hora_inicio}
              onChange={(e) =>
                setForm({ ...form, hora_inicio: e.target.value })
              }
              required
            />
          </div>
          <div className="au-field">
            <label className="au-label">Hora fin</label>
            <input
              className="au-input"
              type="time"
              value={form.hora_fin}
              onChange={(e) => setForm({ ...form, hora_fin: e.target.value })}
              required
            />
          </div>
          <div className="au-field">
            <label className="au-label">Máx. horas por reserva</label>
            <input
              className="au-input"
              type="number"
              min="1"
              value={form.max_horas_por_reserva}
              onChange={(e) =>
                setForm({ ...form, max_horas_por_reserva: e.target.value })
              }
              required
            />
          </div>
          <div className="au-field" style={{ alignSelf: "end" }}>
            <button
              className="au-button au-button--ghost"
              type="button"
              onClick={resetForm}
            >
              Limpiar
            </button>
          </div>
          <div className="au-field" style={{ alignSelf: "end" }}>
            <button
              className="au-button"
              type="submit"
              disabled={!areaId || !valid || loading}
            >
              {editingId ? "Guardar cambios" : "Agregar regla"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <p className="error" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}

      {/* Listado */}
      <div className="card">
        <h3>Reglas configuradas</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : items.length === 0 ? (
          <p>No hay reglas registradas para este filtro.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="au-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Día</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Máx. horas/reserva</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.id}</td>
                    <td>
                      {DIA_CHOICES.find((d) => d.value === it.dia_semana)
                        ?.label ?? it.dia_semana}
                    </td>
                    <td>{String(it.hora_inicio).slice(0, 5)}</td>
                    <td>{String(it.hora_fin).slice(0, 5)}</td>
                    <td>{it.max_horas_por_reserva}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        className="au-button au-button--ghost"
                        onClick={() => onEdit(it)}
                      >
                        Editar
                      </button>{" "}
                      <button
                        className="au-button au-button--ghost"
                        onClick={() => onDelete(it.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
