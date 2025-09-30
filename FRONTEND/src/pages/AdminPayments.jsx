// src/pages/AdminPayments.jsx
import { useEffect, useState } from "react";
import { apiIntentsDashboard, apiVerifyReceipt } from "../api/payments";

export default function AdminPayments() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setErr(""); setMsg("");
    try { setItems(await apiIntentsDashboard()); }
    catch (e) { setErr(e.message); }
  }
  useEffect(()=>{ load(); }, []);

  async function approve(it) {
    // Backend pide receipt_id (del comprobante). En sim usamos uno "falso".
    let receiptId = it._sim ? guessSimReceiptId(it.id) : Number(prompt("receipt_id a aprobar:"));
    if (!receiptId) return;
    try {
      await apiVerifyReceipt({ receipt_id: receiptId, approve: true });
      setMsg(`Intento #${it.id} aprobado.`);
      await load();
    } catch (e) { setErr(e.message); }
  }
  async function reject(it) {
    let receiptId = it._sim ? guessSimReceiptId(it.id) : Number(prompt("receipt_id a rechazar:"));
    if (!receiptId) return;
    try {
      await apiVerifyReceipt({ receipt_id: receiptId, approve: false, note: "Rechazado por admin" });
      setMsg(`Intento #${it.id} rechazado.`);
      await load();
    } catch (e) { setErr(e.message); }
  }

  // Para sim: buscamos el último "receipt sim" que corresponda al intent (mismo id == intent)
  function guessSimReceiptId(intentId) {
    // truco: el sim guarda receipts con id incremental, pero los vinculamos por intent
    // para simplificar, usamos el intentId como receipt_id cuando sea sim.
    return intentId;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Dashboard de intentos</h2>
        <div style={{display:"flex", gap:8}}>
          <button style={styles.btn} onClick={load}>Refrescar</button>
          <button style={styles.btn} onClick={()=>console.log("[INTENTS]", items)}>Ver en consola</button>
        </div>
      </div>

      {err && <p style={styles.err}>{err}</p>}
      {msg && <p style={styles.ok}>{msg}</p>}

      <div style={{display:"grid", gap:16}}>
        {items.map((it)=>(
          <div key={it.id} style={styles.card}>
            <div style={styles.row}>
              <div style={{fontWeight:600}}>Intent #{it.id}</div>
              <div style={styles.badge(it.status)}>{it.status}</div>
            </div>

            <div style={styles.small}>
              monto: {it.amount ?? "—"} • cuota: {it.cuota ?? "—"} {it._sim && <em style={{opacity:.7}}> (sim)</em>}
            </div>

            {it.qr_payload && <div style={styles.mono}>QR: {it.qr_payload}</div>}
            {it.confirmation_url && (
              <div style={styles.mono}>
                URL: <a href={it.confirmation_url} target="_blank">{it.confirmation_url}</a>
              </div>
            )}

            <div style={styles.actions}>
              {(it.status === "PENDING" || it.status === "CREATED") ? (
                <>
                  <button style={{...styles.btn, borderColor:"#14532d"}} onClick={()=>approve(it)}>Aprobar</button>
                  <button style={{...styles.btn, borderColor:"#7f1d1d"}} onClick={()=>reject(it)}>Rechazar</button>
                </>
              ) : (
                <span style={styles.muted}>No hay acciones disponibles.</span>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && <p style={styles.muted}>No hay pendientes.</p>}
      </div>
    </div>
  );
}

const styles = {
  wrap: { padding: 24, maxWidth: 1100, margin: "0 auto" },
  headerRow: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 12 },
  title: { margin:0, fontSize:22, fontWeight:700 },
  btn: { padding:"8px 12px", border:"1px solid #334155", background:"#0b1424", color:"#e5e7eb", borderRadius: 8 },
  err: { color:"#ef4444", fontWeight:600 },
  ok: { color:"#10b981", fontWeight:600 },
  muted: { opacity:.7 },
  card: { background:"rgba(15,23,42,.65)", border:"1px solid #223047", borderRadius:12, padding:14 },
  row: { display:"flex", alignItems:"center", gap:10 },
  small: { marginTop:6, opacity:.9, fontSize:14 },
  mono: { marginTop:6, fontSize:13, opacity:.9, wordBreak:"break-all", fontFamily:"ui-monospace, Menlo, Monaco, Consolas, 'Courier New', monospace" },
  actions: { marginTop:12, display:"flex", gap:8, alignItems:"center" },
  badge: (s)=>({
    marginLeft:"auto",
    fontSize:12, padding:"2px 8px",
    borderRadius:999,
    border:"1px solid",
    borderColor: s==="PAID" ? "#14532d" : s==="FAILED" ? "#7f1d1d" : "#334155",
    color:"#e5e7eb",
    background: s==="PAID" ? "rgba(20,83,45,.25)" : s==="FAILED" ? "rgba(127,29,29,.25)" : "rgba(51,65,85,.25)",
  }),
};
