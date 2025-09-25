// src/pages/AdminTareasPage.jsx
import { useEffect, useState } from "react";
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  changeTaskState,
  listUnidades,
} from "../api/tareas";
import TareaModal from "./modals/TareaModal";

const ESTADOS = [
  "NUEVA",
  "ASIGNADA",
  "EN_PROGRESO",
  "BLOQUEADA",
  "COMPLETADA",
  "CANCELADA",
];
const PRIORIDADES = ["BAJA", "MEDIA", "ALTA", "URGENTE"];

const INIT = {
  titulo: "",
  descripcion: "",
  prioridad: "MEDIA",
  estado: "NUEVA",
  unidad: "",
  fecha_limite: "",
  fecha_inicio: "",
  adjuntos: [],
};

export default function AdminTareasPage() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // form
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState(INIT);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  // catálogos
  const [unidades, setUnidades] = useState([]);

  // modal detalle
  const [detailId, setDetailId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const items = await listTasks({
        search: q || undefined,
        estado: estado || undefined,
        prioridad: prioridad || undefined,
        ordering: "-updated_at",
      });
      setData(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    listUnidades({ is_active: true, ordering: "torre" }).then(setUnidades);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editingId) await updateTask(editingId, sanitize(form));
      else await createTask(sanitize(form));
      reset();
      await load();
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la tarea.");
    }
  };

  const sanitize = (p) => {
    const s = { ...p };
    s.unidad = s.unidad || null;
    s.fecha_limite = s.fecha_limite || null;
    s.fecha_inicio = s.fecha_inicio || null;
    return s;
  };

  const reset = () => {
    setForm(INIT);
    setEditingId(null);
    setOpenForm(false);
    setError("");
  };

  const editRow = (it) => {
    setEditingId(it.id);
    setOpenForm(true);
    setForm({
      titulo: it.titulo || "",
      descripcion: it.descripcion || "",
      prioridad: it.prioridad || "MEDIA",
      estado: it.estado || "NUEVA",
      unidad: it.unidad?.id || "",
      fecha_inicio: it.fecha_inicio || "",
      fecha_limite: it.fecha_limite || "",
      adjuntos: it.adjuntos || [],
    });
  };

  const stateSelect = (it) => (
    <select
      className="au-input"
      value={it.estado}
      onChange={(e) => changeTaskState(it.id, e.target.value).then(load)}
    >
      {ESTADOS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <h2>Tareas (Admin/Staff)</h2>

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
            <label className="au-label">Buscar</label>
            <input
              className="au-input"
              placeholder="título, descripción…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="au-field" style={{ minWidth: 160 }}>
            <label className="au-label">Estado</label>
            <select
              className="au-input"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="">(todos)</option>
              {ESTADOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="au-field" style={{ minWidth: 160 }}>
            <label className="au-label">Prioridad</label>
            <select
              className="au-input"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
            >
              <option value="">(todas)</option>
              {PRIORIDADES.map((s) => (
                <option key={s} value={s}>
                  {s}
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
              setEstado("");
              setPrioridad("");
              load();
            }}
          >
            Limpiar
          </button>
          <button
            type="button"
            className="au-button au-button--ghost"
            onClick={() => {
              setOpenForm(true);
              setEditingId(null);
              setForm(INIT);
            }}
          >
            + Nueva tarea
          </button>
        </form>
      </div>

      {/* Formulario */}
      {openForm && (
        <form className="card" onSubmit={submit} style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>
            {editingId ? "Editar tarea" : "Nueva tarea"}
          </h3>
          {error && <p className="error">{error}</p>}

          <div className="au-field">
            <label className="au-label">Título</label>
            <input
              className="au-input"
              name="titulo"
              value={form.titulo}
              onChange={onChange}
              required
            />
          </div>

          <div className="au-field" style={{ marginTop: 8 }}>
            <label className="au-label">Descripción</label>
            <textarea
              className="au-input"
              name="descripcion"
              value={form.descripcion}
              onChange={onChange}
            />
          </div>

          <div className="au-grid-3" style={{ marginTop: 8 }}>
            <div className="au-field">
              <label className="au-label">Prioridad</label>
              <select
                className="au-input"
                name="prioridad"
                value={form.prioridad}
                onChange={onChange}
              >
                {PRIORIDADES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="au-field">
              <label className="au-label">Estado</label>
              <select
                className="au-input"
                name="estado"
                value={form.estado}
                onChange={onChange}
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="au-field">
              <label className="au-label">Unidad</label>
              <select
                className="au-input"
                name="unidad"
                value={form.unidad}
                onChange={onChange}
              >
                <option value="">(sin unidad)</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.torre}
                    {u.bloque ? `-${u.bloque}` : ""}-{u.numero}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="au-grid-3" style={{ marginTop: 8 }}>
            <div className="au-field">
              <label className="au-label">Inicio</label>
              <input
                className="au-input"
                type="date"
                name="fecha_inicio"
                value={form.fecha_inicio}
                onChange={onChange}
              />
            </div>
            <div className="au-field">
              <label className="au-label">Vence</label>
              <input
                className="au-input"
                type="date"
                name="fecha_limite"
                value={form.fecha_limite}
                onChange={onChange}
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <button className="au-button">
              {editingId ? "Guardar cambios" : "Crear tarea"}
            </button>
            <button
              type="button"
              className="au-button au-button--ghost"
              onClick={reset}
              style={{ marginLeft: 8 }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tabla */}
      <div className="card" style={{ marginTop: 12, overflowX: "auto" }}>
        <table className="au-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Vence</th>
              <th>Asignado</th>
              <th>Unidad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8}>Cargando…</td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={8}>Sin resultados.</td>
              </tr>
            )}
            {data.map((it) => (
              <tr key={it.id}>
                <td>{it.id}</td>
                <td>{it.titulo}</td>
                <td>
                  <span
                    className={`tag tag--prio-${(
                      it.prioridad || ""
                    ).toLowerCase()}`}
                  >
                    {it.prioridad}
                  </span>
                </td>
                <td style={{ minWidth: 180 }}>{stateSelect(it)}</td>
                <td>{it.fecha_limite || "—"}</td>
                <td>
                  {it.asignado_a?.username
                    ? `@${it.asignado_a.username}`
                    : it.asignado_a_rol?.code
                    ? `Rol: ${it.asignado_a_rol.code}`
                    : "—"}
                </td>
                <td>
                  {it.unidad
                    ? `${it.unidad.torre}${
                        it.unidad.bloque ? "-" + it.unidad.bloque : ""
                      }-${it.unidad.numero}`
                    : "—"}
                </td>
                <td className="au-actions">
                  <button
                    className="au-button au-button--ghost"
                    onClick={() => setDetailId(it.id)}
                  >
                    Ver
                  </button>
                  <button
                    className="au-button au-button--ghost"
                    onClick={() => editRow(it)}
                  >
                    Editar
                  </button>
                  <button
                    className="au-button au-button--ghost"
                    onClick={async () => {
                      if (confirm("¿Eliminar?")) {
                        await deleteTask(it.id);
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

      {/* Modal detalle */}
      <TareaModal
        open={!!detailId}
        tareaId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
