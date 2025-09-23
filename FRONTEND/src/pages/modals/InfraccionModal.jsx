// src/pages/modals/InfraccionModal.jsx
import { useEffect, useState } from "react";

const TIPO = ["RUIDO", "MASCOTA", "ESTACIONAMIENTO", "DANOS", "OTRA"];
const ESTADO = ["PENDIENTE", "RESUELTA", "ANULADA"];

export default function InfraccionModal({ initial, onClose, onOk }) {
  const [form, setForm] = useState({
    unidad_id: "", residente_id: "", fecha: "", tipo: "RUIDO",
    descripcion: "", monto: "0.00", evidencia_url: "", estado: "PENDIENTE",
    is_active: true,
  });

  useEffect(()=> {
    if (initial) {
      setForm({
        unidad_id: initial.unidad?.id || "",
        residente_id: "", // si quieres precargarlo, agrega "residente?.id" en tu serializer
        fecha: initial.fecha || "",
        tipo: initial.tipo || "RUIDO",
        descripcion: initial.descripcion || "",
        monto: String(initial.monto ?? "0.00"),
        evidencia_url: initial.evidencia_url || "",
        estado: initial.estado || "PENDIENTE",
        is_active: initial.is_active ?? true,
      });
    }
  }, [initial]);

  return (
    <div className="modal">
      <div className="card modal__content" style={{width:520}}>
        <h3>{initial ? "Editar infracción" : "Nueva infracción"}</h3>

        <label>Unidad ID</label>
        <input className="au-input" value={form.unidad_id}
               onChange={e=>setForm({...form, unidad_id:e.target.value})} required />

        <label>Residente ID (opcional)</label>
        <input className="au-input" value={form.residente_id}
               onChange={e=>setForm({...form, residente_id:e.target.value})} />

        <label>Fecha</label>
        <input className="au-input" type="date" value={form.fecha}
               onChange={e=>setForm({...form, fecha:e.target.value})} required />

        <label>Tipo</label>
        <select className="au-input" value={form.tipo}
                onChange={e=>setForm({...form, tipo:e.target.value})}>
          {TIPO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label>Descripción</label>
        <textarea className="au-input" rows={3} value={form.descripcion}
                  onChange={e=>setForm({...form, descripcion:e.target.value})} />

        <label>Monto</label>
        <input className="au-input" type="number" step="0.01" value={form.monto}
               onChange={e=>setForm({...form, monto:e.target.value})} />

        <label>Evidencia (URL)</label>
        <input className="au-input" value={form.evidencia_url}
               onChange={e=>setForm({...form, evidencia_url:e.target.value})} />

        <label>Estado</label>
        <select className="au-input" value={form.estado}
                onChange={e=>setForm({...form, estado:e.target.value})}>
          {ESTADO.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <label className="au-checkbox" style={{marginTop:8}}>
          <input type="checkbox" checked={form.is_active}
                 onChange={e=>setForm({...form, is_active:e.target.checked})}/>
          Activa
        </label>

        <div className="modal__actions">
          <button className="au-button au-button--ghost" onClick={onClose}>Cancelar</button>
          <button className="au-button" onClick={()=>{
            const payload = {
              unidad_id: Number(form.unidad_id),
              residente_id: form.residente_id ? Number(form.residente_id) : null,
              fecha: form.fecha,
              tipo: form.tipo,
              descripcion: form.descripcion,
              monto: parseFloat(form.monto || 0),
              evidencia_url: form.evidencia_url,
              estado: form.estado,
              is_active: !!form.is_active,
            };
            onOk(payload);
          }}>{initial ? "Guardar" : "Crear"}</button>
        </div>
      </div>
    </div>
  );
}
