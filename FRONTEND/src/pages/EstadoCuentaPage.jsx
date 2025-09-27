import { useEffect, useRef, useState } from "react";
import { getEstadoCuenta, downloadEstadoCuentaCSV } from "../api/estado_cuenta";
import "./EstadoCuentaPage.css";

const fmtBs = (n) => `Bs. ${Number(n || 0).toFixed(2)}`;

const PRINT_STYLES = `
  :root{
    --txt:#111827;
    --muted:#6b7280;
    --stroke:#d1d5db;
  }
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;color:var(--txt);background:#fff;}
  h2,h3{margin:0 0 10px 0}
  .muted{color:var(--muted);font-size:12px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0}
  .kpi{border:1px solid var(--stroke);border-radius:10px;padding:12px;background:#fff}
  .kpi .kpi-title{font-size:12px;color:var(--muted)}
  .kpi .kpi-value{font-size:20px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid var(--stroke);padding:6px 8px;text-align:left;font-size:12px}
  th{background:#f3f4f6}
`;

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

  // -------- IMPRESIÓN ROBUSTA POR IFRAME OCULTO ----------
  function printHtml(html) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const { document: doc } = iframe.contentWindow;
    doc.open();
    doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Estado de cuenta</title>
    <style>${PRINT_STYLES}</style>
  </head>
  <body>${html}</body>
</html>`);
    doc.close();

    // Pequeña espera para que el layout se estabilice
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error("Print error:", err);
      } finally {
        // Limpieza tras otro tick (algunos navegadores no permiten remover de inmediato)
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 200);
      }
    }, 150);
  }

  function handlePrint() {
    const html = printRef.current?.innerHTML || "";
    if (!html) {
      alert("No hay contenido para imprimir.");
      return;
    }
    printHtml(html);
  }
  // --------------------------------------------------------

  const estadoChip = (estado) => {
    const key = String(estado || "").toLowerCase();
    const cls =
      key.includes("pagada") || key.includes("pagado") ? "chip chip--ok" :
      key.includes("parcial") ? "chip chip--warn" :
      "chip chip--pending";
    return <span className={cls}>{estado || "-"}</span>;
  };

  return (
    <div className="ec-page">
      {/* Toolbar */}
      <div className="card ec-toolbar">
        <form className="au-toolbar__form" onSubmit={(e)=>e.preventDefault()}>
          <div className="au-field min-260">
            <label className="au-label">Unidad</label>
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

          <button
            type="button"
            className="au-button"
            onClick={() => downloadEstadoCuentaCSV(unidadSel || undefined)}
          >
            Descargar CSV
          </button>
          <button type="button" className="au-button au-button--ghost" onClick={handlePrint}>
            Imprimir
          </button>
        </form>
      </div>

      {/* Contenido imprimible */}
      <div className="card ec-card" ref={printRef}>
        {/* Encabezado */}
        <h2 className="m-0">Estado de cuenta</h2>
        <div className="muted mb-10">
          Unidad: {data?.unidad
            ? `${data.unidad.torre}-${data.unidad.bloque}-${data.unidad.numero} (ID ${data.unidad.id})`
            : "—"} · Fecha de corte: {resumen.fecha_corte || "—"}
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
        <div className="section-head">
          <h3 className="mt-16 mb-6">Cuotas</h3>
          <div className="muted">{cuotas.length} registro(s)</div>
        </div>
        <div className="table-wrap">
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
                <tr><td colSpan={7} className="txt-center muted p-12">Sin cuotas</td></tr>
              ) : cuotas.map(c => {
                const saldo = (Number(c.total_a_pagar)||0) - (Number(c.pagado)||0);
                return (
                  <tr key={c.id}>
                    <td>{c.periodo}</td>
                    <td>{c.concepto}</td>
                    <td>{c.vencimiento}</td>
                    <td>{fmtBs(c.total_a_pagar)}</td>
                    <td>{fmtBs(c.pagado)}</td>
                    <td className={saldo > 0 ? "neg" : "pos"}>{fmtBs(saldo)}</td>
                    <td>{estadoChip(c.estado)}</td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        {/* Pagos */}
        <div className="section-head">
          <h3 className="mt-16 mb-6">Pagos</h3>
          <div className="muted">{pagos.length} registro(s)</div>
        </div>
        <div className="table-wrap">
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
                <tr><td colSpan={6} className="txt-center muted p-12">Sin pagos</td></tr>
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
    </div>
  );
}

function KPI({ title, value }) {
  return (
    <div className="kpi">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}
