import { useEffect, useMemo, useRef, useState } from "react";

function fmt2(n) { return String(n).padStart(2, "0"); }
function todayParts() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}
function currentYYYYMM() {
  const { y, m } = todayParts();
  return `${y}-${fmt2(m)}`;
}
function endOfMonthISO(yyyyMm) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${fmt2(m)}-${fmt2(last)}`;
}

export default function GenerarCuotasModal({ onClose, onOk }) {
  const initialPeriodo = useMemo(() => currentYYYYMM(), []);
  const initialVenc   = useMemo(() => endOfMonthISO(initialPeriodo), [initialPeriodo]);

  const [form, setForm] = useState({
    periodo: initialPeriodo,
    concepto: "GASTO_COMUN",
    monto_base: "",
    usa_coeficiente: true,
    vencimiento: initialVenc,
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const firstInputRef = useRef(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function validate(state) {
    const errs = {};
    if (!state.periodo) errs.periodo = "Selecciona un periodo.";
    if (!state.concepto?.trim()) errs.concepto = "Concepto requerido.";
    const mb = parseFloat(state.monto_base);
    if (Number.isNaN(mb) || mb <= 0) errs.monto_base = "Monto base > 0.";
    if (!state.vencimiento) errs.vencimiento = "Selecciona un vencimiento.";
    // ❌ Sin restricción de mismo mes entre periodo y vencimiento
    return errs;
  }

  async function handleSubmit() {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      setSubmitting(true);
      await onOk({
        ...form,
        monto_base: parseFloat(form.monto_base || 0),
      });
    } catch (e) {
      setErrors({ _root: e?.detail || "Error al generar cuotas." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal">
      <div className="card modal__content">
        <div className="modal__head">
          <h3 className="m-0">Generar cuotas</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {errors._root && <p className="error">{errors._root}</p>}

        <div className="form-grid">
          {/* Periodo */}
          <div className="au-field min-260">
            <label className="au-label">Periodo</label>
            <input
              ref={firstInputRef}
              className={`au-input ${errors.periodo ? "has-error" : ""}`}
              type="month"
              value={form.periodo}
              onChange={(e) => {
                const per = e.target.value; // YYYY-MM
                setForm((s) => ({
                  ...s,
                  periodo: per,
                  // mantiene autocompletado de conveniencia (se puede editar libremente)
                  vencimiento: endOfMonthISO(per),
                }));
              }}
            />
            {errors.periodo && <span className="field-error">{errors.periodo}</span>}
          </div>

          {/* Concepto */}
          <div className="au-field min-260">
            <label className="au-label">Concepto</label>
            <input
              className={`au-input ${errors.concepto ? "has-error" : ""}`}
              placeholder="GASTO_COMUN"
              value={form.concepto}
              onChange={(e) => setForm({ ...form, concepto: e.target.value })}
            />
            {errors.concepto && <span className="field-error">{errors.concepto}</span>}
          </div>

          {/* Monto base */}
          <div className="au-field min-260">
            <label className="au-label">Monto base</label>
            <input
              className={`au-input ${errors.monto_base ? "has-error" : ""}`}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              value={form.monto_base}
              onChange={(e) => setForm({ ...form, monto_base: e.target.value })}
            />
            {errors.monto_base && <span className="field-error">{errors.monto_base}</span>}
          </div>

          {/* Usa coeficiente */}
          <div className="au-field">
            <label className="au-checkbox">
              <input
                type="checkbox"
                checked={form.usa_coeficiente}
                onChange={(e) => setForm({ ...form, usa_coeficiente: e.target.checked })}
              />
              <span>Usar coeficiente de unidad</span>
            </label>
          </div>

          {/* Vencimiento */}
          <div className="au-field min-260">
            <label className="au-label">Vencimiento</label>
            <input
              className={`au-input ${errors.vencimiento ? "has-error" : ""}`}
              type="date"
              value={form.vencimiento}
              onChange={(e) => setForm({ ...form, vencimiento: e.target.value })}
            />
            {errors.vencimiento && <span className="field-error">{errors.vencimiento}</span>}
          </div>
        </div>

        <div className="modal__actions">
          <button className="au-button au-button--ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="au-button" type="button" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Generando…" : "Generar"}
          </button>
        </div>
      </div>
    </div>
  );
}
