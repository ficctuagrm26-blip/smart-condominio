// src/pages/modals/InfraccionModal.jsx
import { useEffect, useRef, useState } from "react";
import api from "../../api/auth";

const TIPO = ["RUIDO", "MASCOTA", "ESTACIONAMIENTO", "DANOS", "OTRA"];
const ESTADO = ["PENDIENTE", "RESUELTA", "ANULADA"];

// helpers
function fmtUnidad(u) {
  if (!u) return "";
  const manzana = u.manzana ?? u.torre;
  const lote = u.lote ?? u.bloque;
  const b = lote ? `-${lote}` : "";
  return `Mza ${manzana}${b}-${u.numero}`;
}
function mapUsers(rows) {
  return rows.map((u) => {
    const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    return {
      id: u.id,
      name: full || u.username || u.email || `Usuario ${u.id}`,
      email: u.email || "",
    };
  });
}

export default function InfraccionModal({ initial, onClose, onOk }) {
  // formulario
  const [form, setForm] = useState({
    unidad_id: "",
    residente_id: "",
    fecha: "",
    tipo: "RUIDO",
    descripcion: "",
    monto: "0.00",
    evidencia_url: "",
    estado: "PENDIENTE",
    is_active: true,
  });

  // combos
  const [units, setUnits] = useState([]);         // [{id,label}]
  const [residents, setResidents] = useState([]); // [{id,name,email}]
  const [loadingCombos, setLoadingCombos] = useState(false);

  // búsqueda local de unidades
  const [unitQuery, setUnitQuery] = useState("");
  const filteredUnits = unitQuery
    ? units.filter((u) => u.label.toLowerCase().includes(unitQuery.toLowerCase()))
    : units;

  const firstRef = useRef(null);

  // precarga si viene initial
  useEffect(() => {
    if (!initial) return;
    setForm({
      unidad_id: initial.unidad?.id || "",
      residente_id: initial.residente?.id || "",
      fecha: initial.fecha || "",
      tipo: initial.tipo || "RUIDO",
      descripcion: initial.descripcion || "",
      monto: String(initial.monto ?? "0.00"),
      evidencia_url: initial.evidencia_url || "",
      estado: initial.estado || "PENDIENTE",
      is_active: initial.is_active ?? true,
    });
  }, [initial]);

  // cargar combos
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCombos(true);
        const [uRes, rRes] = await Promise.all([
          api.get("unidades/", {
            params: {
              is_active: true,
              ordering: "manzana,lote,numero",
              page_size: 1000,
            },
          }),
          api.get("admin/users/residents/", {
            params: { is_active: true, ordering: "first_name,last_name", page_size: 1000 },
          }),
        ]);

        if (!mounted) return;

        const uRows = Array.isArray(uRes.data) ? uRes.data : uRes.data.results || [];
        const rRows = Array.isArray(rRes.data) ? rRes.data : rRes.data.results || [];

        setUnits(uRows.map((u) => ({ id: u.id, label: fmtUnidad(u) })));
        setResidents(mapUsers(rRows));
      } catch (e) {
        console.error("Combos infracción:", e);
      } finally {
        if (mounted) setLoadingCombos(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // UX: foco/Escape
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
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
    if (!payload.unidad_id) {
      alert("Selecciona una unidad válida");
      return;
    }
    onOk(payload);
  };

  return (
    <div className="modal">
      <div className="card modal__content" style={{ width: 600 }}>
        <div className="modal__head">
          <h3 className="m-0">{initial ? "Editar infracción" : "Nueva infracción"}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Unidad */}
        <div className="au-field">
          <label className="au-label">Unidad</label>
          <div className="unit-picker">
            <input
              ref={firstRef}
              className="au-input unit-picker__search"
              placeholder="Buscar por manzana/lote/número…"
              value={unitQuery}
              onChange={(e) => setUnitQuery(e.target.value)}
              disabled={loadingCombos}
            />
            <select
              className="au-input unit-picker__select"
              value={form.unidad_id}
              onChange={(e) => setForm((s) => ({ ...s, unidad_id: e.target.value }))}
              disabled={loadingCombos || filteredUnits.length === 0}
            >
              <option value="">(selecciona)</option>
              {filteredUnits.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Residente (opcional) */}
        <div className="au-field">
          <label className="au-label">Residente (opcional)</label>
          <select
            className="au-input"
            value={form.residente_id}
            onChange={(e) => setForm((s) => ({ ...s, residente_id: e.target.value }))}
            disabled={loadingCombos}
          >
            <option value="">(sin residente)</option>
            {residents.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}{u.email ? ` — ${u.email}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Fecha + Tipo */}
        <div className="grid-2">
          <div className="au-field">
            <label className="au-label">Fecha</label>
            <input
              className="au-input"
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              required
            />
          </div>
          <div className="au-field">
            <label className="au-label">Tipo</label>
            <select
              className="au-input"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              {TIPO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Descripción */}
        <div className="au-field">
          <label className="au-label">Descripción</label>
          <textarea
            className="au-input"
            rows={3}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </div>

        {/* Monto + Evidencia URL */}
        <div className="grid-2">
          <div className="au-field">
            <label className="au-label">Monto</label>
            <input
              className="au-input"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
            />
          </div>
          <div className="au-field">
            <label className="au-label">Evidencia (URL)</label>
            <input
              className="au-input"
              value={form.evidencia_url}
              onChange={(e) => setForm({ ...form, evidencia_url: e.target.value })}
            />
          </div>
        </div>

        {/* Estado + Activa */}
        <div className="grid-2">
          <div className="au-field">
            <label className="au-label">Estado</label>
            <select
              className="au-input"
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
            >
              {ESTADO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="au-field" style={{ paddingTop: 28 }}>
            <label className="au-checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span>Activa</span>
            </label>
          </div>
        </div>

        <div className="modal__actions">
          <button className="au-button au-button--ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="au-button" type="button" onClick={submit}>
            {initial ? "Guardar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
