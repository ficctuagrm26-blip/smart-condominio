// src/api/cuotas.js
const RAW_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";
const BASE = RAW_BASE.endsWith("/") ? RAW_BASE : RAW_BASE + "/";

// Helper para unir paths sin duplicar slash
const u = (path) => `${BASE}${path}`; // path sin slash inicial, ej. 'cuotas/'

// Headers con token
function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
}

// parseo seguro de errores JSON
async function safeJson(res) {
  try { return await res.json(); } catch { return { detail: res.statusText || "Error" }; }
}

// helper de querystring (omite null/undefined/"")
function qs(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * LISTAR CUOTAS (con filtros/search/ordering/paginación)
 * Soporta pageUrl absoluto (ej. DRF next) o build con BASE.
 * Filtros soportados por tu ViewSet:
 *   unidad, periodo, concepto, estado, is_active, unidad__torre
 * Search: periodo, concepto, unidad__torre, unidad__bloque, unidad__numero
 * Ordering: vencimiento, updated_at, total_a_pagar, pagado, periodo  (usa "-" descendente)
 */
export async function listCuotas(params = {}, pageUrl) {
  // Si viene una URL absoluta (next), úsala tal cual e ignora params
  const url = pageUrl || (u("cuotas/") + qs({
    page: params.page,
    page_size: params.page_size,
    unidad: params.unidad,
    periodo: params.periodo,
    concepto: params.concepto,
    estado: params.estado,
    is_active: params.is_active,
    "unidad__torre": params.torre,
    search: params.search,
    ordering: params.ordering,
  }));

  const res = await fetch(url, { headers: authHeaders() });
  const data = await safeJson(res);
  if (!res.ok) throw data;
  return data; // {results, count, next, previous} (o lista si no hay paginación)
}

/** GET detalle de una cuota (opcional) */
export async function getCuota(id) {
  const res = await fetch(u(`cuotas/${id}/`), { headers: authHeaders() });
  const data = await safeJson(res);
  if (!res.ok) throw data;
  return data;
}

/**
 * GENERAR CUOTAS (POST /cuotas/generar/)
 * payload: { periodo, concepto, monto_base, usa_coeficiente, vencimiento }
 */
export async function generarCuotas(payload) {
  const res = await fetch(u("cuotas/generar/"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await safeJson(res);
  if (!res.ok) throw data; // {ok, cuotas_afectadas, total}
  return data;
}

/**
 * PAGAR DESDE CUOTA (POST /cuotas/:id/pagos/)
 * payload (según tu PagoCreateSerializer): { monto, medio, referencia?, valido? ... }
 */
export async function pagarCuota(cuotaId, payload) {
  const res = await fetch(u(`cuotas/${cuotaId}/pagos/`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await safeJson(res);
  if (!res.ok) throw data; // devuelve pago serializado
  return data;
}

/**
 * ANULAR CUOTA (POST /cuotas/:id/anular/)
 * backend: bloquea si tiene pagos
 */
export async function anularCuota(cuotaId) {
  const res = await fetch(u(`cuotas/${cuotaId}/anular/`), {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await safeJson(res);
  if (!res.ok) throw data; // devuelve cuota actualizada
  return data;
}

/* (Opcional) crear/actualizar/eliminar cuota directa, si usas el CRUD base del ModelViewSet
export async function createCuota(payload) {
  const r = await fetch(u("cuotas/"), { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
  const d = await safeJson(r); if (!r.ok) throw d; return d;
}
export async function updateCuota(id, payload) {
  const r = await fetch(u(`cuotas/${id}/`), { method: "PATCH", headers: authHeaders(), body: JSON.stringify(payload) });
  const d = await safeJson(r); if (!r.ok) throw d; return d;
}
export async function deleteCuota(id) {
  const r = await fetch(u(`cuotas/${id}/`), { method: "DELETE", headers: authHeaders() });
  if (!r.ok && r.status !== 204) throw await safeJson(r);
  return true;
}
*/
