import { useState } from "react";

export default function GenerarCuotasModal({ onClose, onOk }) {
  const [form, setForm] = useState({
    periodo: "", concepto: "", monto_base: "", usa_coeficiente: true, vencimiento: "",
  });
  const [err, setErr] = useState("");

  return (
    <div className="modal">
      <div className="card modal__content">
        <h3>Generar cuotas</h3>
        {err && <p className="error">{err}</p>}

        <label>Periodo (YYYY-MM)</label>
        <input className="au-input" value={form.periodo}
               onChange={(e)=>setForm({...form, periodo:e.target.value})} />

        <label>Concepto</label>
        <input className="au-input" value={form.concepto}
               onChange={(e)=>setForm({...form, concepto:e.target.value})} />

        <label>Monto base</label>
        <input className="au-input" type="number" step="0.01" value={form.monto_base}
               onChange={(e)=>setForm({...form, monto_base:e.target.value})} />

        <label className="au-checkbox">
          <input type="checkbox" checked={form.usa_coeficiente}
                 onChange={(e)=>setForm({...form, usa_coeficiente:e.target.checked})}/>
          Usar coeficiente de unidad
        </label>

        <label>Vencimiento (YYYY-MM-DD)</label>
        <input className="au-input" value={form.vencimiento}
               onChange={(e)=>setForm({...form, vencimiento:e.target.value})} />

        <div className="modal__actions">
          <button className="au-button au-button--ghost" onClick={onClose}>Cancelar</button>
          <button className="au-button" onClick={async()=>{
            try {
              setErr("");
              await onOk({ ...form, monto_base: parseFloat(form.monto_base || 0) });
            } catch (e) {
              setErr(e?.detail || "Error");
            }
          }}>Generar</button>
        </div>
      </div>
    </div>
  );
}
