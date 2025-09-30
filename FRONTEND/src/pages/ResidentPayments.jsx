// src/pages/ResidentPayments.jsx
import { useEffect, useMemo, useState } from "react";
import { apiMisCuotasConSaldo, apiCheckout, apiUploadReceipt } from "../api/payments";
import qrImg from "../assets/QR.jpg"; 

function QRPreview({ open, onClose, payload }) {
  if (!open) return null;
  return (
    <div style={styles.backdrop} onClick={onClose}>
  <div style={styles.modal} onClick={(e)=>e.stopPropagation()}>
    <h3 style={styles.h3}>QR (simulado)</h3>
    <p style={{fontSize:12, opacity:.8, marginTop:-8}}>
      Escanéalo con tu app bancaria (simulación)
    </p>

    <div style={styles.qrBox}>
      <img
        src={qrImg}            // ← viene de /public
        alt="QR de pago"
        style={{ width: 220, height: 220, objectFit: "contain", display: "block", margin: "0 auto" }}
      />
      {payload && (
        <div style={{ marginTop: 10, fontSize: 12, opacity: .8, wordBreak: "break-all" }}>
          <span style={{fontWeight:600}}>Payload:</span> {payload}
        </div>
      )}
    </div>

    <div style={{display:"flex", gap:8, marginTop: 10}}>
      {payload && (
        <button
          style={styles.btn}
          onClick={() => { navigator.clipboard?.writeText(payload); }}
          title="Copiar payload"
        >
          Copiar payload
        </button>
      )}
      {payload && (
        <a
          style={{...styles.btn, textDecoration:"none", display:"inline-block"}}
          href={payload}
          target="_blank"
          rel="noreferrer"
        >
          Abrir payload
        </a>
      )}
      <button style={styles.btn} onClick={onClose}>Cerrar</button>
    </div>
  </div>
</div>
  );
}

export default function ResidentPayments() {
  const [rows, setRows] = useState([]);
  const [loading, setL] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [qr, setQr] = useState({ open:false, payload:"" });

  async function load() {
    setL(true); setErr(""); setMsg("");
    try { setRows(await apiMisCuotasConSaldo()); }
    catch (e) { setErr(e.message); }
    finally { setL(false); }
  }
  useEffect(()=>{ load(); }, []);

  const handleCheckout = async (c, medio) => {
    try {
      const r = await apiCheckout({ cuota: c.id, medio });
      setMsg(`Intento #${r.id} → ${r.status}`);
      await load();
      // si es QR, mostramos modal con payload
      if (medio === "QR") {
        setQr({ open:true, payload: r.qr_payload || r.confirmation_url || "" });
      } else if (r.confirmation_url) {
        window.open(r.confirmation_url, "_blank");
      }
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleUpload = async (c) => {
    // usa último intento por defecto
    const intent = Number(prompt("ID de intento (deja vacío para usar último):", c?.ultimo_intento?.id || ""));
    if (!intent) return;
    const amount = prompt("Monto reportado:", c.saldo);
    const reference = prompt("Referencia:", "PRUEBA-123");
    const receipt_url = prompt("URL del comprobante (mock):", "https://picsum.photos/600");
    try {
      await apiUploadReceipt({ intent, amount, reference, receipt_url, bank_name: "Banco X" });
      setMsg("Comprobante enviado.");
      await load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const hasRows = useMemo(()=>Array.isArray(rows) && rows.length>0, [rows]);

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Mis cuotas con saldo</h2>
        <div style={{display:"flex", gap:8}}>
          <button style={styles.btn} onClick={load}>Refrescar</button>
          <button style={styles.btn} onClick={()=>console.log("[INTENTS]", rows)}>Ver mis intents (console)</button>
        </div>
      </div>

      {loading && <p style={styles.muted}>Cargando…</p>}
      {err && <p style={styles.err}>{err}</p>}
      {msg && <p style={styles.ok}>{msg}</p>}
      {!loading && !hasRows && <p style={styles.muted}>No tienes cuotas pendientes.</p>}

      <div style={{display:"grid", gap:18}}>
        {rows.map((c)=> {
          const puedeSubir = c.ultimo_intento && ["PENDING","CREATED"].includes(c.ultimo_intento.status);
          return (
            <div key={c.id} style={styles.card}>
              <div style={styles.cardHead}>
                <div style={styles.cardTitle}>{c.unidad} • {c.periodo} • {c.concepto}</div>
              </div>
              <div style={styles.info}>
                Total: <b>{c.total_a_pagar}</b> — Pagado: <b>{c.pagado}</b> — Saldo: <b>{c.saldo}</b> — Estado: <b>{c.estado}</b>
              </div>

              <div style={styles.actions}>
                <button style={styles.btn} onClick={()=>handleCheckout(c,"QR")}>Pagar por QR</button>
                <button style={styles.btn} onClick={()=>handleCheckout(c,"CARD")}>Pagar Tarjeta (mock)</button>
                <button
                  style={{...styles.btn, opacity: puedeSubir?1:.5, cursor: puedeSubir?"pointer":"not-allowed"}}
                  disabled={!puedeSubir}
                  title={puedeSubir?"":"Primero crea un intento QR (PENDING)"}
                  onClick={()=>handleUpload(c)}
                >
                  Subir comprobante
                </button>
              </div>

              {c.ultimo_intento && (
                <div style={styles.last}>
                  Último intento: id <b>{c.ultimo_intento.id}</b> • <b>{c.ultimo_intento.status}</b>
                  {c.ultimo_intento.confirmation_url && (
                    <> • <a href={c.ultimo_intento.confirmation_url} target="_blank">abrir URL</a></>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <QRPreview open={qr.open} payload={qr.payload} onClose={()=>setQr({open:false,payload:""})} />
    </div>
  );
}

const styles = {
  wrap: { padding: "24px", maxWidth: 1100, margin: "0 auto" },
  headerRow: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  muted: { opacity:.7 },
  ok: { color: "#10b981", fontWeight: 600 },
  err: { color: "#ef4444", fontWeight: 600 },
  card: { background: "rgba(15,23,42,.65)", border:"1px solid #223047", borderRadius: 12, padding: 16 },
  cardHead: { display:"flex", justifyContent:"space-between", alignItems:"center" },
  cardTitle: { fontWeight: 600, fontSize: 16 },
  info: { marginTop: 6, opacity: .9 },
  actions: { marginTop: 12, display:"flex", gap: 10, flexWrap:"wrap" },
  last: { marginTop: 10, fontSize: 13, opacity: .9 },
  btn: { padding:"8px 12px", border:"1px solid #334155", background:"#0b1424", color:"#e5e7eb", borderRadius: 8 },
  backdrop: { position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"grid", placeItems:"center", zIndex:50 },
  modal: { background:"#0b1424", color:"#e5e7eb", border:"1px solid #334155", borderRadius:12, padding:18, width: "min(680px, 92vw)" },
  h3: { margin:0, marginBottom:10, fontSize:18 },
  qrBox: { border:"1px dashed #334155", borderRadius:10, padding:10, margin:"6px 0 12px", background:"#0a1020" },
  pre: { whiteSpace:"pre-wrap", wordBreak:"break-all", margin:0, fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" },
};
