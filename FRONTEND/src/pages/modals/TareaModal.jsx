// src/pages/modals/TareaModal.jsx
import { useEffect, useState } from "react";
import "./tarea-modal.css";
import { getTask, commentTask } from "../../api/tareas";

export default function TareaModal({ open, onClose, tareaId }) {
  const [item, setItem] = useState(null);
  const [txt, setTxt] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !tareaId) return;
    setLoading(true);
    getTask(tareaId)
      .then(setItem)
      .finally(() => setLoading(false));
  }, [open, tareaId]);

  const addComment = async () => {
    const body = (txt || "").trim();
    if (!body) return;
    const c = await commentTask(tareaId, body);
    setItem((it) => ({ ...it, comentarios: [...(it?.comentarios || []), c] }));
    setTxt("");
  };

  if (!open) return null;

  const asignado = item?.asignado_a?.username
    ? `@${item.asignado_a.username}`
    : item?.asignado_a_rol?.code
    ? `Rol: ${item.asignado_a_rol.code}`
    : "—";

  const uni = item?.unidad
    ? `${item.unidad.torre}${
        item.unidad.bloque ? "-" + item.unidad.bloque : ""
      }-${item.unidad.numero}`
    : "—";

  return (
    <div className="tarea-overlay" onClick={onClose}>
      <div
        className="tarea-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="tarea-head">
          <h3 className="tarea-title">
            {item?.titulo || "Tarea"}
            {item && (
              <span
                className={`tag tag--state-${(
                  item.estado || ""
                ).toLowerCase()}`}
              >
                {item.estado}
              </span>
            )}
          </h3>
          <button className="au-button au-button--ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : (
          <>
            <div className="tarea-meta">
              <div>
                <b>Prioridad:</b>{" "}
                <span
                  className={`tag tag--prio-${(
                    item?.prioridad || ""
                  ).toLowerCase()}`}
                >
                  {item?.prioridad}
                </span>
              </div>
              <div>
                <b>Unidad:</b> {uni}
              </div>
              <div>
                <b>Asignado:</b> {asignado}
              </div>
              <div>
                <b>Vence:</b> {item?.fecha_limite || "—"}
              </div>
            </div>

            <div className="tarea-body">{item?.descripcion || "—"}</div>

            {!!item?.adjuntos?.length && (
              <div className="tarea-attach">
                <h4>Adjuntos</h4>
                {item.adjuntos.map((u, i) => (
                  <div key={i}>
                    <a href={u} target="_blank" rel="noreferrer">
                      Archivo {i + 1}
                    </a>
                  </div>
                ))}
              </div>
            )}

            <div className="tarea-comments">
              <h4>Comentarios</h4>
              {(item?.comentarios || []).map((c) => (
                <div key={c.id} className="tarea-comment">
                  <div className="tarea-comment__meta">
                    <b>{c.autor?.username || "—"}</b>
                    <span className="muted">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>{c.cuerpo}</div>
                </div>
              ))}

              <div className="tarea-comment__new">
                <input
                  className="au-input"
                  placeholder="Escribe un comentario…"
                  value={txt}
                  onChange={(e) => setTxt(e.target.value)}
                />
                <button className="au-button" onClick={addComment}>
                  Enviar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
