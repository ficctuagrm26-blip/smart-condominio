// src/api/payments.js
// Usa tus helpers de axios y agrega una capa de simulación local cuando el backend no responda.
import { get, post } from "./auth";

// ====== SIMULACIÓN LOCAL (fallback) ======
const SIM_KEYS = {
  INTENTS: "sim_intents",
  RECEIPTS: "sim_receipts",
};

function lsGet(key, def) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); }
  catch { return def; }
}
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function nowIso() { return new Date().toISOString(); }

function simListCuotas() {
  // Cuotas fake con saldo
  return [
    {
      id: 1001,
      unidad: "Mza A-101",
      periodo: "2025-09",
      concepto: "Limpieza",
      total_a_pagar: "500.00",
      pagado: "324.99",
      saldo: "175.01",
      estado: "PARCIAL",
      ultimo_intento: simFindLastIntentForCuota(1001),
    },
    {
      id: 1002,
      unidad: "Mza A-101",
      periodo: "2025-09",
      concepto: "PRUEBA",
      total_a_pagar: "25.00",
      pagado: "10.00",
      saldo: "15.00",
      estado: "PARCIAL",
      ultimo_intento: simFindLastIntentForCuota(1002),
    },
  ];
}
function simFindLastIntentForCuota(cuotaId) {
  const intents = lsGet(SIM_KEYS.INTENTS, []);
  const it = intents.filter(i => i.cuota === cuotaId).sort((a,b)=>b.id-a.id)[0];
  return it ? {
    id: it.id,
    status: it.status,
    qr_payload: it.qr_payload || "",
    confirmation_url: it.confirmation_url || "",
  } : null;
}
function simCreateIntent({ cuota, medio="QR", amount=null }) {
  const intents = lsGet(SIM_KEYS.INTENTS, []);
  const id = (intents[0]?.id || 0) + 1;
  const url = `${window.location.origin}/mock-pay?intent=${id}`;
  const status = medio === "CARD" ? "PAID" : "PENDING";
  const intent = {
    id, cuota, amount: amount ?? null, provider: "MOCK",
    status, created_at: nowIso(),
    confirmation_url: url, qr_payload: medio === "QR" ? url : "",
    _sim: true,
  };
  intents.unshift(intent);
  lsSet(SIM_KEYS.INTENTS, intents);
  return intent;
}
function simUploadReceipt({ intent, amount, reference, bank_name, receipt_url }) {
  // Crear "receipt" y dejar el intent en PENDING; admin decidirá.
  const intents = lsGet(SIM_KEYS.INTENTS, []);
  const i = intents.find(x => x.id === Number(intent));
  if (!i) throw new Error("Intento no encontrado (sim).");
  const receipts = lsGet(SIM_KEYS.RECEIPTS, []);
  const rid = (receipts[0]?.id || 0) + 1;
  const rec = { id: rid, intent: i.id, amount, reference, bank_name, receipt_url, uploaded_at: nowIso(), _sim:true };
  receipts.unshift(rec);
  lsSet(SIM_KEYS.RECEIPTS, receipts);
  // lo dejamos PENDING (si ya era PAID, no lo tocamos)
  if (i.status !== "PAID") {
    i.status = "PENDING";
    lsSet(SIM_KEYS.INTENTS, intents);
  }
  return rec;
}
function simIntentsDashboard() {
  return lsGet(SIM_KEYS.INTENTS, []);
}
function simVerifyReceipt({ receipt_id, approve, amount, note }) {
  const receipts = lsGet(SIM_KEYS.RECEIPTS, []);
  const intents = lsGet(SIM_KEYS.INTENTS, []);
  const rec = receipts.find(r => r.id === Number(receipt_id));
  if (!rec) throw new Error("Receipt no encontrado (sim).");
  const i = intents.find(x => x.id === rec.intent);
  if (!i) throw new Error("Intento no encontrado (sim).");

  if (approve) {
    i.status = "PAID";
    i.paid_at = nowIso();
  } else {
    i.status = "FAILED";
  }
  lsSet(SIM_KEYS.INTENTS, intents);
  return { ok:true, intent:i.id, status:i.status };
}

// ====== API REAL + FALLBACK ======

// Lista de cuotas con saldo del usuario
export async function apiMisCuotasConSaldo() {
  // 1) intenta mock oficial
  try {
    return await get("pagos/mock/mis-cuotas-con-saldo/");
  } catch (e1) {
    // 2) fallback a tus cuotas QR
    try {
      const rows = await get("pagos/qr/pendientes/");
      return rows.map(c => ({
        id: c.id, unidad: c.unidad, periodo: c.periodo, concepto: c.concepto,
        total_a_pagar: c.total_a_pagar, pagado: c.pagado, saldo: c.saldo, estado: c.estado,
        ultimo_intento: c.ultimo_intento || null,
      }));
    } catch (e2) {
      // 3) simulación
      console.warn("[payments] usando SIMULACIÓN local de cuotas:", e2?.message || e2);
      return simListCuotas();
    }
  }
}

// Crear intento de pago
export async function apiCheckout({ cuota, medio="QR", amount=null }) {
  // intentar backend
  try {
    const body = { cuota, medio };
    if (amount !== null && amount !== undefined && String(amount).trim() !== "") {
      body.amount = amount;
    }
    return await post("pagos/mock/checkout/", body);
  } catch (e) {
    // fallback SIM
    console.warn("[payments] checkout sim:", e?.message || e);
    return simCreateIntent({ cuota, medio, amount });
  }
}

// Subir comprobante (residente)
export async function apiUploadReceipt({ intent, amount, reference, bank_name, receipt_url }) {
  try {
    const body = { intent, reference, receipt_url };
    if (bank_name) body.bank_name = bank_name;
    if (amount !== null && amount !== undefined && String(amount).trim() !== "") {
      body.amount = amount;
    }
    return await post("pagos/mock/receipt/", body);
  } catch (e) {
    // SIM
    console.warn("[payments] upload sim:", e?.message || e);
    return simUploadReceipt({ intent, amount, reference, bank_name, receipt_url });
  }
}

// Dashboard intents (admin/staff)
export async function apiIntentsDashboard() {
  try {
    return await get("pagos/mock/intents/dashboard/");
  } catch (e) {
    console.warn("[payments] dashboard sim:", e?.message || e);
    return simIntentsDashboard();
  }
}

// Admin/staff: aprobar/rechazar comprobante
export async function apiVerifyReceipt({ receipt_id, approve, amount, note }) {
  try {
    const body = { receipt_id, approve: !!approve };
    if (amount !== undefined && amount !== null && String(amount).trim() !== "") body.amount = amount;
    if (note) body.note = note;
    return await post("pagos/mock/verify/", body);
  } catch (e) {
    // SIM
    console.warn("[payments] verify sim:", e?.message || e);
    return simVerifyReceipt({ receipt_id, approve, amount, note });
  }
}
