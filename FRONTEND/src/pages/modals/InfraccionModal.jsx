// src/pages/modals/InfraccionModal.jsx
import { useEffect, useMemo, useRef, useState } from "react";

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
function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function InfraccionModal({ initial, onClose, onOk }) {
  // ======= form base =======
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

  // ======= búsqueda Unidad =======
  const [unitSearch, setUnitSearch] = useState("");
  const debUnit = useDebounced(unitSearch, 350);
  const [unitOpts, setUnitOpts] = useState([]);
  const [unitLoading, setUnitLoading] = useState(false);

  // ======= búsqueda Residente =======
  const [residentSearch, setResidentSearch] = useState("");
  const debRes = useDebounced(residentSearch, 350);
  const [residentOpts, setResidentOpts] = useState([]);
  const [residentLoading, setResidentLoading] = useState(false);

  const firstRef = useRef(null);

  // Precarga desde initial
  useEffect(() => {
    if (!initial) return;
    setForm({
      unidad_id: initial.unidad?.id || "",
      residente_id: initial.residente?.id || "", // si lo incluyes en tu serializer
      fecha: initial.fecha || "",
      tipo: initial.tipo || "RUIDO",
      descripcion: initial.descripcion || "",
      monto: String(initial.monto ?? "0.00"),
      evidencia_url: initial.evidencia_url || "",
      estado: initial.estado || "PENDIENTE",
      is_active: initial.is_active ?? true,
    });
    // precarga de textos de búsqueda
    if (initial.unidad) setUnitSearch(fmtUnidad(initial.unidad));
    if (initial.residente) {
      const u = initial.residente;
      const name = `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.username || u.email || `#${u.id}`;
      setResidentSearch(`${name} · id:${u.id}`);
    }
  }, [initial]);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ==== GET unidades (autocompletar)
  useEffect(() => {
    let abort = new AbortController();
    async function run() {
      const q = debUnit.trim();
      if (!q) { setUnitOpts([]); return; }
      setUnitLoading(true);
      try {
        // endpoint: /api/unidades/?search=...&page_size=10
        const url = `/api/unidades/?search=${encodeURIComponent(q)}&page_size=10`;
        const r = await fetch(url, { signal: abort.signal });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        const items = data.results || data;
        setUnitOpts(items);
      } catch (_) {
        if (!abort.signal.aborted) setUnitOpts([]);
      } finally {
        if (!abort.signal.aborted) setUnitLoading(false);
      }
    }
    run();
    return () => abort.abort();
  }, [debUnit]);

  // ==== GET residentes (solo base RESIDENT) – usa tu action /admin/users/residents
  useEffect(() => {
    let abort = new AbortController();
    async function run() {
      const q = debRes.trim();
      if (!q) { setResidentOpts([]); return; }
      setResidentLoading(true);
      try {
        // endpoint: /api/admin/users/residents/?search=...&page_size=10
        const url = `/api/admin/users/residents/?search=${encodeURIComponent(q)}&page_size=10`;
        const r = await fetch(url, { signal: abort.signal });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        const items = data.results || data;
        setResidentOpts(items);
      } catch (_) {
        if (!abort.signal.aborted) setResidentOpts([]);
      } finally {
        if (!abort.signal.aborted) setResidentLoading(false);
      }
    }
    run();
    return () => abort.abort();
  }, [debRes]);

  function onPickUnidad(value) {
    // value del datalist será "id – label", aceptamos también solo id
    const id = String(value).match(/\d+/)?.[0];
    if (id) setForm((s) => ({ ...s, unidad_id: id }));
  }
  function onPickResidente(value) {
    const id = String(value).match(/\d+/)?.[0];
    setForm((s) => ({ ...s, residente_id: id || "" }));
  }

  return (
    <div className="modal">
      <div className="card modal__content" style={{ width: 560 }}>
        <div className="modal__head">
          <h3 className="m-0">{initial ? "Editar infracción" : "Nueva infracción"}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Unidad combobox */}
        <div className="au-field">
          <label className="au-label">Unidad</label>
          <div className="combo">
            <input
              ref={firstRef}
              className="au-input"
              list="unidades-list"
              placeholder="Busca por manzana/lote/número…"
              value={unitSearch}
              onChange={(e) => { setUnitSearch(e.target.value); onPickUnidad(e.target.value); }}
            />
            <datalist id="unidades-list">
              {unitOpts.map((u) => (
                <option key={u.id} value={`${u.id} – ${fmtUnidad(u)}`} />
              ))}
            </datalist>
            <div className="assist">
              {unitLoading ? "Buscando…" : form.unidad_id ? `id:${form.unidad_id}` : "sin selección"}
              {form.unidad_id && (
                <button
                  type="button"
                  className="mini-clear"
                  onClick={() => { setForm({ ...form, unidad_id: "" }); setUnitSearch(""); }}
                  title="Borrar selección"
                >Limpiar</button>
              )}
            </div>
          </div>
        </div>

        {/* Residente combobox */}
        <div className="au-field">
          <label className="au-label">Residente (opcional)</label>
          <div className="combo">
            <input
              className="au-input"
              list="residentes-list"
              placeholder="Busca por nombre/usuario/email…"
              value={residentSearch}
              onChange={(e) => { setResidentSearch(e.target.value); onPickResidente(e.target.value); }}
            />
            <datalist id="residentes-list">
              {residentOpts.map((u) => {
                const full = `${u.first_name || ""} ${u.last_name || ""}`.trim();
                const label = full || u.username || u.email || `id:${u.id}`;
                return <option key={u.id} value={`${label} · id:${u.id}`} />;
              })}
            </datalist>
            <div className="assist">
              {residentLoading ? "Buscando…" : form.residente_id ? `id:${form.residente_id}` : "sin residente"}
              {form.residente_id && (
                <button
                  type="button"
                  className="mini-clear"
                  onClick={() => { setForm({ ...form, residente_id: "" }); setResidentSearch(""); }}
                >Quitar</button>
              )}
            </div>
          </div>
        </div>

        {/* Resto del formulario */}
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

        <div className="au-field">
          <label className="au-label">Descripción</label>
          <textarea
            className="au-input"
            rows={3}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </div>

        <div className="grid-2">
          <div className="au-field">
            <label className="au-label">Monto</label>
            <input
              className="au-input"
              type="number"
              step="0.01"
              min="0"
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
          <button className="au-button au-button--ghost" onClick={onClose}>Cancelar</button>
          <button
            className="au-button"
            onClick={() => {
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
            }}
          >
            {initial ? "Guardar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
