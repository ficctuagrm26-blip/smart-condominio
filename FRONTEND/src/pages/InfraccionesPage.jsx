// src/pages/InfraccionesPage.jsx
import { useEffect, useMemo, useState } from "react";
import {
  listInfracciones, createInfraccion, updateInfraccion, deleteInfraccion,
  resolverInfraccion, anularInfraccion
} from "../api/infracciones";
import InfraccionModal from "./modals/InfraccionModal";
import "./InfraccionesPage.css";

const ORDER_ALLOWED = new Set(["fecha", "monto", "updated_at"]);
const isAnulada = (s) => String(s || "").toUpperCase() === "ANULADA";

const TIPOS = [
  ["", "Tipo"],
  ["RUIDO", "Ruido"],
  ["MASCOTA", "Mascota"],
  ["ESTACIONAMIENTO", "Estacionamiento indebido"],
  ["DANOS", "Daños"],
  ["OTRA", "Otra"],
];

function unidadDisplay(u) {
  if (!u) return "-";
  // compat: algunos serializers viejos exponen torre/bloque
  const manzana = u.manzana ?? u.torre;
  const lote = u.lote ?? u.bloque;
  const b = lote ? `-${lote}` : "";
  return `Mza ${manzana}${b}-${u.numero ?? ""}`;
}

export default function InfraccionesPage() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [prev, setPrev] = useState(null);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("-fecha");
  const [f, setF] = useState({ unidad: "", residente: "", estado: "", tipo: "", is_active: "" });

  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const ariaSort = useMemo(() => {
    const field = ordering.replace(/^-/, "");
    const dir = ordering.startsWith("-") ? "descending" : "ascending";
    return { field, dir };
  }, [ordering]);

  async function load(pageUrl) {
    setLoading(true);
    try {
      const params = {
        search,
        ordering,
        page_size: 20,
        unidad: f.unidad || undefined,
        residente: f.residente || undefined,
        estado: f.estado || undefined,
        tipo: f.tipo || undefined,
        is_active: f.is_active === "" ? undefined : f.is_active === "true",
      };
      const data = await listInfracciones(params, pageUrl);
      const results = data.results || data;
      setRows(results);
      setCount(data.count ?? results.length);
      setNext(data.next ?? null);
      setPrev(data.previous ?? null);
    } catch (e) {
      console.error(e);
      alert(e?.detail || "Error al listar infracciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [ordering]);

  function toggleOrder(field) {
    if (!ORDER_ALLOWED.has(field)) return;
    setOrdering((o) => (o === field ? `-${field}` : field));
  }

  function estadoChipClass(e) {
    const s = String(e || "").toUpperCase();
    if (s === "RESUELTA") return "chip chip--ok";
    if (s === "ANULADA")  return "chip chip--dark";
    return "chip chip--warn"; // PENDIENTE u otro
  }

  return (
    <div className="page ec-page">
      {/* Formulario unificado */}
      <div className="card ec-toolbar mb-12">
        <form
          className="filter-form"
          onSubmit={(e) => { e.preventDefault(); load(); }}
        >
          <div className="au-field span-3">
            <label className="au-label">Buscar</label>
            <input
              className="au-input"
              placeholder="unidad/descripcion (texto libre)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="au-field">
            <label className="au-label">Unidad ID</label>
            <input
              className="au-input"
              placeholder="ej. 123"
              value={f.unidad}
              onChange={(e) => setF({ ...f, unidad: e.target.value })}
            />
          </div>

          <div className="au-field">
            <label className="au-label">Residente ID</label>
            <input
              className="au-input"
              placeholder="ej. 45"
              value={f.residente}
              onChange={(e) => setF({ ...f, residente: e.target.value })}
            />
          </div>

          <div className="au-field">
            <label className="au-label">Tipo</label>
            <select
              className="au-input"
              value={f.tipo}
              onChange={(e) => setF({ ...f, tipo: e.target.value })}
            >
              {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div className="au-field">
            <label className="au-label">Estado</label>
            <select
              className="au-input"
              value={f.estado}
              onChange={(e) => setF({ ...f, estado: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="RESUELTA">Resuelta</option>
              <option value="ANULADA">Anulada</option>
            </select>
          </div>

          <div className="au-field">
            <label className="au-label">Registro</label>
            <select
              className="au-input"
              value={f.is_active}
              onChange={(e) => setF({ ...f, is_active: e.target.value })}
            >
              <option value="">Activas + Inactivas</option>
              <option value="true">Solo activas</option>
              <option value="false">Solo inactivas</option>
            </select>
          </div>

          <div className="filter-actions">
            <div className="actions-left">
              <button className="au-button" type="submit">Aplicar</button>
              <button
                className="au-button au-button--ghost"
                type="button"
                onClick={() => {
                  setF({ unidad: "", residente: "", estado: "", tipo: "", is_active: "" });
                  setSearch("");
                  load();
                }}
              >
                Limpiar
              </button>
            </div>
            <button
              className="au-button"
              type="button"
              onClick={() => { setEditing(null); setShowModal(true); }}
            >
              + Nueva infracción
            </button>
          </div>
        </form>
      </div>

      {/* Tabla */}
      <div className="card ec-card">
        <div className="table-wrap">
          <table className="au-table">
            <thead>
              <tr>
                <th>Unidad</th>
                <th
                  onClick={() => toggleOrder("fecha")}
                  className="is-clickable"
                  aria-sort={ariaSort.field === "fecha" ? ariaSort.dir : "none"}
                >
                  Fecha
                </th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th
                  onClick={() => toggleOrder("monto")}
                  className="is-clickable"
                  aria-sort={ariaSort.field === "monto" ? ariaSort.dir : "none"}
                >
                  Monto
                </th>
                <th>Estado</th>
                <th className="txt-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="txt-center muted">Cargando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="txt-center muted">Sin resultados</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td>{unidadDisplay(r.unidad)}</td>
                  <td>{r.fecha}</td>
                  <td>{r.tipo}</td>
                  <td className="td-ellipsis" title={r.descripcion || ""}>{r.descripcion}</td>
                  <td>{Number(r.monto).toFixed(2)}</td>
                  <td><span className={estadoChipClass(r.estado)}>{r.estado}</span></td>
                  <td className="actions">
                    <button
                      className="au-button"
                      onClick={() => { setEditing(r); setShowModal(true); }}
                      title="Editar"
                    >
                      Editar
                    </button>
                    <button
                      className="au-button au-button--ghost"
                      onClick={async () => {
                        if (!confirm("¿Eliminar esta infracción?")) return;
                        try { await deleteInfraccion(r.id); load(); }
                        catch (e) { alert(e?.detail || "No se pudo eliminar"); }
                      }}
                      title="Eliminar"
                    >
                      Eliminar
                    </button>
                    <button
                      className="au-button"
                      disabled={isAnulada(r.estado)}
                      onClick={async () => {
                        try { await resolverInfraccion(r.id); load(); }
                        catch (e) { alert(e?.detail || "No se pudo resolver"); }
                      }}
                      title="Resolver"
                    >
                      Resolver
                    </button>
                    <button
                      className="au-button au-button--ghost"
                      disabled={isAnulada(r.estado)}
                      onClick={async () => {
                        if (!confirm("¿Anular esta infracción?")) return;
                        try { await anularInfraccion(r.id); load(); }
                        catch (e) { alert(e?.detail || "No se pudo anular"); }
                      }}
                      title="Anular"
                    >
                      Anular
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <button className="au-button" disabled={!prev} onClick={() => load(prev)}>Anterior</button>
          <button className="au-button" disabled={!next} onClick={() => load(next)}>Siguiente</button>
          <div className="ml-auto text-muted">Total: {count}</div>
        </div>
      </div>

      {showModal && (
        <InfraccionModal
          initial={editing}
          onClose={() => setShowModal(false)}
          onOk={async (payload) => {
            try {
              if (editing) await updateInfraccion(editing.id, payload);
              else await createInfraccion(payload);
              setShowModal(false);
              load();
            } catch (e) {
              console.error(e);
              alert(e?.detail || "Error al guardar");
            }
          }}
        />
      )}
    </div>
  );
}
