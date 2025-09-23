// src/pages/EstadoCuentaPage.jsx
import { useEffect, useRef, useState } from "react";
import { getEstadoCuenta, downloadEstadoCuentaCSV } from "../api/estado_cuenta";

const fmtBs = (n) => `Bs. ${Number(n || 0).toFixed(2)}`;

export default function EstadoCuentaPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [unidadSel, setUnidadSel] = useState("");
  const printRef = useRef(null);

  async function load(unidadId) {
    setLoading(true);
    try {
      const d = await getEstadoCuenta(unidadId || undefined);
      setData(d);
      setUnidadSel(String(d?.unidad?.id || ""));
    } catch (e) {
      console.error(e);
      alert(e?.detail || "No se pudo cargar el estado de cuenta");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const resumen = data?.resumen || {};
  const cuotas = data?.cuotas || [];
  const pagos = data?.pagos || [];

  function handlePrint() {
    // Imprime solo el contenido del card principal (ref)
    const html = printRef.current?.innerHTML || "";
    const w = window.open("", "_blank");
    w.document.write(`
      <html>
        <head>
          <title>Estado de cuenta</title>
          <meta charset="utf-8" />
          <style>
            body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;color:#e5e7eb;background:#0b1020;}
            table{width:100%;border-collapse:collapse}
            th,td{border:1px solid #1f2937;padding:6px;text-align:left}
            h2,h3{margin:0 0 10px 0}
            .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0}
            .kpi{border:1px solid #1f2937;border-radius:8px;padding:10px;background:#0f1422}
            .muted{opacity:.8;font-size:12px}
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  return (
    <div className="page">
      <div className="card au-toolbar" style={{ marginBottom: 12 }}>
        <div className="au-toolbar__form" onSubmit={(e)=>e.preventDefault()}>
          <div>
            <div className="au-label">Unidad</div>
            <select
              className="au-input"
              value={unidadSel}
              onChange={(e)=>{ setUnidadSel(e.target.value); load(e.target.value); }}
            >
              {(data?.unidades || []).map(u => (
                <option key={u.id} value={u.id}>
                  {u.torre}-{u.bloque}-{u.numero} (ID {u.id})
                </option>
              ))}
            </select>
          </div>

          <div className="au-toolbar__spacer" />

          <button className="au-button" onClick={() => downloadEstadoCuentaCSV(unidadSel || undefined)}>
            Descargar CSV
          </button>
          <button className="au-button au-button--ghost" onClick={handlePrint}>
            Imprimir
          </button>
        </div>
      </div>

      <div className="card" ref={printRef}>
        {/* Encabezado imprimible */}
        <h2>Estado de cuenta</h2>
        <div className="muted" style={{marginBottom:10}}>
          Unidad: {data?.unidad ? `${data.unidad.torre}-${data.unidad.bloque}-${data.unidad.numero} (ID ${data.unidad.id})` : "—"} ·
          &nbsp;Fecha de corte: {resumen.fecha_corte || "—"}
        </div>

        {/* KPIs */}
        <div className="kpis">
          <KPI title="Saldo pendiente" value={fmtBs(resumen.saldo_pendiente)} />
          <KPI title="Cuotas pendientes" value={resumen.cuotas_pendientes ?? 0} />
          <KPI title="Total pagado (hist.)" value={fmtBs(resumen.total_pagado_historico)} />
          <KPI title="Total cobrado (hist.)" value={fmtBs(resumen.total_cobrado_historico)} />
        </div>
        <div className="muted">
          Último pago: {resumen.ultimo_pago
            ? `${resumen.ultimo_pago.fecha_pago} • ${fmtBs(resumen.ultimo_pago.monto)} (${resumen.ultimo_pago.medio})`
            : "—"}
        </div>

        {/* Cuotas */}
        <h3 style={{marginTop:16}}>Cuotas</h3>
        <table className="au-table">
          <thead>
            <tr>
              <th>Periodo</th><th>Concepto</th><th>Vencimiento</th>
              <th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>Cargando…</td></tr>
            ) : (cuotas.length === 0 ? (
              <tr><td colSpan={7}>Sin cuotas</td></tr>
            ) : cuotas.map(c => {
              const saldo = (Number(c.total_a_pagar)||0) - (Number(c.pagado)||0);
              return (
                <tr key={c.id}>
                  <td>{c.periodo}</td>
                  <td>{c.concepto}</td>
                  <td>{c.vencimiento}</td>
                  <td>{fmtBs(c.total_a_pagar)}</td>
                  <td>{fmtBs(c.pagado)}</td>
                  <td>{fmtBs(saldo)}</td>
                  <td>{c.estado}</td>
                </tr>
              );
            }))}
          </tbody>
        </table>

        {/* Pagos */}
        <h3 style={{marginTop:16}}>Pagos</h3>
        <table className="au-table">
          <thead>
            <tr>
              <th>Fecha</th><th>Monto</th><th>Medio</th><th>Referencia</th><th>Periodo</th><th>Concepto</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}>Cargando…</td></tr>
            ) : (pagos.length === 0 ? (
              <tr><td colSpan={6}>Sin pagos</td></tr>
            ) : pagos.map(p => (
              <tr key={p.id}>
                <td>{p.fecha_pago}</td>
                <td>{fmtBs(p.monto)}</td>
                <td>{p.medio}</td>
                <td>{p.referencia}</td>
                <td>{p.cuota_periodo || "—"}</td>
                <td>{p.cuota_concepto || "—"}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ title, value }) {
  return (
    <div className="kpi" style={{ padding:12, border:"1px solid #1f2937", borderRadius:8, background:"#0f1422" }}>
      <div style={{ fontSize:12, opacity:.8 }}>{title}</div>
      <div style={{ fontSize:20, fontWeight:700 }}>{value}</div>
    </div>
  );
}
