import { useState } from "react";

export default function PagarCuotaModal({ cuota, onClose, onOk }) {
  const saldo = (cuota.total_a_pagar ?? 0) - (cuota.pagado ?? 0);
  const [form, setForm] = useState({
    monto: saldo > 0 ? Number(saldo).toFixed(2) : "0.00",
    medio: "EFECTIVO",
    referencia: "",
    valido: true,
  });

  return (
    <div className="modal">
      <div className="card modal__content">
        <h3>Pagar — {cuota.unidad?.torre}-{cuota.unidad?.bloque}-{cuota.unidad?.numero} / {cuota.periodo}</h3>
        <p>Saldo actual: <b>{Number(saldo).toFixed(2)}</b></p>

        <label>Monto</label>
        <input className="au-input" type="number" step="0.01" value={form.monto}
               onChange={(e)=>setForm({...form, monto:e.target.value})} />

        <label>Medio</label>
        <select className="au-input" value={form.medio}
                onChange={(e)=>setForm({...form, medio:e.target.value})}>
          <option>EFECTIVO</option>
          <option>TRANSFERENCIA</option>
          <option>TARJETA</option>
          <option>QR</option>
        </select>

        <label>Referencia (opcional)</label>
        <input className="au-input" value={form.referencia}
               onChange={(e)=>setForm({...form, referencia:e.target.value})} />

        <label className="au-checkbox">
          <input type="checkbox" checked={form.valido}
                 onChange={(e)=>setForm({...form, valido:e.target.checked})}/>
          Validar pago
        </label>

        <div className="modal__actions">
          <button className="au-button au-button--ghost" onClick={onClose}>Cancelar</button>
          <button className="au-button" onClick={async()=>{
            await onOk({
              monto: parseFloat(form.monto || 0),
              medio: form.medio,
              referencia: form.referencia,
              valido: form.valido
            });
          }}>Registrar</button>
        </div>
      </div>
    </div>
  );
}
