// src/pages/AdminAreasPage.jsx
import { useEffect, useMemo, useState } from "react";
import { listAreas, createArea, updateArea, deleteArea } from "../api/areas";

export default function AdminAreasPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    ubicacion: "",
    capacidad: 1,
    costo_por_hora: "0.00",
    activa: true,
    requiere_aprobacion: false,
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const resetForm = () =>
    setForm({
      nombre: "",
      descripcion: "",
      ubicacion: "",
      capacidad: 1,
      costo_por_hora: "0.00",
      activa: true,
      requiere_aprobacion: false,
    });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const arr = await listAreas();
      setItems(arr);
    } catch (e) {
      setError("No se pudieron cargar las áreas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion || "",
        ubicacion: form.ubicacion || "",
        capacidad: Number(form.capacidad) || 1,
        costo_por_hora: form.costo_por_hora || "0.00",
        activa: !!form.activa,
        requiere_aprobacion: !!form.requiere_aprobacion,
      };

      if (editingId) {
        await updateArea(editingId, payload);
      } else {
        await createArea(payload);
      }
      resetForm();
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al guardar el área.");
    } finally {
      setLoading(false);
    }
  };

  const onEdit = (it) => {
    setEditingId(it.id);
    setForm({
      nombre: it.nombre || "",
      descripcion: it.descripcion || "",
      ubicacion: it.ubicacion || "",
      capacidad: it.capacidad ?? 1,
      costo_por_hora: String(it.costo_por_hora ?? "0.00"),
      activa: !!it.activa,
      requiere_aprobacion: !!it.requiere_aprobacion,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta área?")) return;
    setLoading(true);
    setError("");
    try {
      await deleteArea(id);
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || "No se pudo eliminar el área.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 1100 }}>
      <h2 style={{ marginBottom: 12 }}>Áreas comunes (Admin)</h2>

      <form
        className="au-form"
        onSubmit={onSubmit}
        style={{ marginBottom: 16 }}
      >
        <div
          className="au-form__grid"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          <div className="au-field">
            <label className="au-label">Nombre</label>
            <input
              className="au-input"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </div>
          <div className="au-field">
            <label className="au-label">Ubicación</label>
            <input
              className="au-input"
              value={form.ubicacion}
              onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
            />
          </div>
          <div className="au-field" style={{ gridColumn: "1 / -1" }}>
            <label className="au-label">Descripción</label>
            <textarea
              className="au-input"
              rows={2}
              value={form.descripcion}
              onChange={(e) =>
                setForm({ ...form, descripcion: e.target.value })
              }
            />
          </div>
          <div className="au-field">
            <label className="au-label">Capacidad</label>
            <input
              className="au-input"
              type="number"
              min="1"
              value={form.capacidad}
              onChange={(e) => setForm({ ...form, capacidad: e.target.value })}
            />
          </div>
          <div className="au-field">
            <label className="au-label">Costo por hora</label>
            <input
              className="au-input"
              type="number"
              step="0.01"
              min="0"
              value={form.costo_por_hora}
              onChange={(e) =>
                setForm({ ...form, costo_por_hora: e.target.value })
              }
            />
          </div>
          <div className="au-field">
            <label className="au-label">Activa</label>
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => setForm({ ...form, activa: e.target.checked })}
            />
          </div>
          <div className="au-field">
            <label className="au-label">Requiere aprobación</label>
            <input
              type="checkbox"
              checked={form.requiere_aprobacion}
              onChange={(e) =>
                setForm({ ...form, requiere_aprobacion: e.target.checked })
              }
            />
          </div>
          <div className="au-field" style={{ alignSelf: "end" }}>
            <button
              className="au-button au-button--ghost"
              type="button"
              onClick={() => {
                resetForm();
                setEditingId(null);
              }}
            >
              Limpiar
            </button>
          </div>
          <div className="au-field" style={{ alignSelf: "end" }}>
            <button className="au-button" type="submit" disabled={loading}>
              {editingId ? "Guardar cambios" : "Crear área"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <p className="error" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}

      <div className="card">
        <h3>Listado</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : items.length === 0 ? (
          <p>No hay áreas registradas.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="au-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Ubicación</th>
                  <th>Capacidad</th>
                  <th>Costo/h</th>
                  <th>Activa</th>
                  <th>Aprueba</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.id}</td>
                    <td>{it.nombre}</td>
                    <td>{it.ubicacion || "—"}</td>
                    <td>{it.capacidad}</td>
                    <td>{it.costo_por_hora}</td>
                    <td>{it.activa ? "Sí" : "No"}</td>
                    <td>{it.requiere_aprobacion ? "Sí" : "No"}</td>
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
