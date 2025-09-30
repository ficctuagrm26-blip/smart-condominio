// src/components/AvisoCard.jsx
import React from "react";
import "./AvisoCard.css"; // (opcional) o usa styles.css global
import { format } from "../utils/datetime";

export default function AvisoCard({ aviso, compact, onEdit, onPublish, onArchive, onDelete }) {
  const {
    id, titulo, cuerpo, status, publish_at, expires_at, created_by, created_at,
  } = aviso;

  return (
    <article className={`av-card ${compact ? "av-card--compact" : ""}`}>
      <header className="av-card__head">
        <span className={`av-badge av-badge--${status.toLowerCase()}`}>{status}</span>
        <h3 className="av-card__title">{titulo}</h3>
      </header>

      {!compact && <p className="av-card__body">{cuerpo}</p>}

      <footer className="av-card__foot">
        <div className="av-meta">
          {publish_at ? <span>Publicación: {format(publish_at)}</span> : <span className="muted">Sin fecha de publicación</span>}
          {expires_at && <span> • Expira: {format(expires_at)}</span>}
        </div>
        <div className="av-meta muted">
          <span>ID #{id}</span>
          {created_by && <span> • por {created_by}</span>}
          {created_at && <span> • {format(created_at)}</span>}
        </div>

        {(onEdit || onPublish || onArchive || onDelete) && (
          <div className="av-actions">
            {onEdit && <button className="btn btn--ghost" onClick={() => onEdit(aviso)}>Editar</button>}
            {onPublish && <button className="btn" disabled={status === "PUBLICADO"} onClick={() => onPublish(aviso)}>Publicar</button>}
            {onArchive && <button className="btn btn--ghost" disabled={status === "ARCHIVADO"} onClick={() => onArchive(aviso)}>Archivar</button>}
            {onDelete && (
              <button
                className="btn btn--danger"
                onClick={() => { if (confirm("¿Eliminar aviso?")) onDelete(aviso); }}
              >
                Eliminar
              </button>
            )}
          </div>
        )}
      </footer>
    </article>
  );
}
