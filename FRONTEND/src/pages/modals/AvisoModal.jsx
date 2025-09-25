// src/pages/modals/AvisoModal.jsx
import { useEffect } from "react";
import "./aviso-modal.css";

export default function AvisoModal({ open, onClose, aviso }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="aviso-overlay" onClick={onClose}>
      <div
        className="aviso-sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <h3 className="aviso-title">{aviso?.titulo || "Aviso"}</h3>
          <button className="au-button au-button--ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="aviso-date">
          {aviso?.publish_at ? new Date(aviso.publish_at).toLocaleString() : ""}
        </div>

        <div className="aviso-body">{aviso?.cuerpo}</div>

        {!!aviso?.adjuntos?.length && (
          <div className="aviso-attach" style={{ marginTop: 12 }}>
            <h4 style={{ margin: "8px 0 6px" }}>Adjuntos</h4>
            {aviso.adjuntos.map((u, i) => (
              <div key={i}>
                <a href={u} target="_blank" rel="noreferrer">
                  Adjunto {i + 1}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
