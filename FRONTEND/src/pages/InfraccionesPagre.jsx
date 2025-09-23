// src/pages/InfraccionesPage.jsx
import { useEffect, useState } from "react";
import {
  listInfracciones, createInfraccion, updateInfraccion, deleteInfraccion,
  resolverInfraccion, anularInfraccion
} from "../api/infracciones";
import InfraccionModal from "./modals/InfraccionModal";

const ORDER_ALLOWED = new Set(["fecha", "monto", "updated_at"]);
const isAnulada = (s) => String(s || "").toUpperCase() === "ANULADA";

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

  async function load(pageUrl) {
    setLoading(true);
    try {
      const params = {
        search, ordering, page_size: 20,
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

  return (
    <div className="page">
      <div className="card au-toolbar" style={{ marginBottom: 12 }}>
        <div className="au-toolbar__form" onSubmit={(e) => e.preventDefault()}>
          <div className="au-field">
            <label className="au-label">Buscar</label>
            <input className="au-input" placeholder="unidad/descripcion..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <input className="au-input" placeholder="Unidad ID" value={f.unidad}
                 onChange={e=>setF({...f, unidad:e.target.value})}/>
          <input className="au-input" placeholder="Residente ID" value={f.residente}
                 onChange={e=>setF({...f, residente:e.target.value})}/>

          <select className="au-input" value={f.tipo} onChange={e=>setF({...f, tipo:e.target.value})}>
            <option value="">Tipo</option>
            <option value="RUIDO">Ruido</option>
            <option value="MASCOTA">Mascota</option>
            <option value="ESTACIONAMIENTO">Estacionamiento</option>
            <option value="DANOS">Daños</option>
            <option value="OTRA">Otra</option>
          </select>

          <select className="au-input" value={f.estado} onChange={e=>setF({...f, estado:e.target.value})}>
            <option value="">Estado</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="RESUELTA">Resuelta</option>
            <option value="ANULADA">Anulada</option>
          </select>

          <select className="au-input" value={f.is_active} onChange={e=>setF({...f, is_active:e.target.value})}>
            <option value="">Activas + Inactivas</option>
            <option value="true">Solo activas</option>
            <option value="false">Solo inactivas</option>
          </select>

          <button className="au-button" onClick={() => load()}>Aplicar</button>
          <button className="au-button au-button--ghost" onClick={()=>{
            setF({ unidad:"", residente:"", estado:"", tipo:"", is_active:"" });
            setSearch(""); load();
          }}>Limpiar</button>

          <div className="au-toolbar__spacer" />
          <button className="au-button" onClick={() => { setEditing(null); setShowModal(true); }}>
            + Nueva infracción
          </button>
        </div>
      </div>

      <div className="card">
        <table className="au-table">
          <thead>
            <tr>
              <th>Unidad</th>
              <th onClick={()=>toggleOrder("fecha")}>Fecha</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th onClick={()=>toggleOrder("monto")}>Monto</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>Cargando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7}>Sin resultados</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td>{r.unidad?.torre}-{r.unidad?.bloque}-{r.unidad?.numero}</td>
                <td>{r.fecha}</td>
                <td>{r.tipo}</td>
                <td style={{maxWidth:380, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                  {r.descripcion}
                </td>
                <td>{Number(r.monto).toFixed(2)}</td>
                <td>{r.estado}</td>
                <td style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                  <button className="au-button" onClick={()=>{ setEditing(r); setShowModal(true); }}>Editar</button>
                  <button className="au-button au-button--ghost" onClick={async()=>{
                    if(!confirm("¿Eliminar esta infracción?")) return;
                    try { await deleteInfraccion(r.id); load(); }
                    catch(e){ alert(e?.detail || "No se pudo eliminar"); }
                  }}>Eliminar</button>
                  <button className="au-button" disabled={isAnulada(r.estado)} onClick={async()=>{
                    try { await resolverInfraccion(r.id); load(); }
                    catch(e){ alert(e?.detail || "No se pudo resolver"); }
                  }}>Resolver</button>
                  <button className="au-button au-button--ghost" disabled={isAnulada(r.estado)} onClick={async()=>{
                    if(!confirm("¿Anular esta infracción?")) return;
                    try { await anularInfraccion(r.id); load(); }
                    catch(e){ alert(e?.detail || "No se pudo anular"); }
                  }}>Anular</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pager" style={{display:"flex", gap:8, padding:12}}>
          <button className="au-button" disabled={!prev} onClick={()=>load(prev)}>Anterior</button>
          <button className="au-button" disabled={!next} onClick={()=>load(next)}>Siguiente</button>
          <div style={{marginLeft:"auto"}}>Total: {count}</div>
        </div>
      </div>

      {showModal && (
        <InfraccionModal
          initial={editing}
          onClose={()=>setShowModal(false)}
          onOk={async (payload)=>{
            try {
              if (editing) await updateInfraccion(editing.id, payload);
              else await createInfraccion(payload);
              setShowModal(false);
              load();
            } catch(e) {
              console.error(e);
              alert(e?.detail || "Error al guardar");
            }
          }}
        />
      )}
    </div>
  );
}
