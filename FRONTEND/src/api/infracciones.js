// src/api/infracciones.js
const RAW_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";
const BASE = RAW_BASE.endsWith("/") ? RAW_BASE : RAW_BASE + "/";
const u = (p) => `${BASE}${p}`;

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
}

async function safeJson(res) {
  try { return await res.json(); } catch { return { detail: res.statusText || "Error" }; }
}

function qs(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function listInfracciones(params = {}, pageUrl) {
  const url = pageUrl || (u("infracciones/") + qs({
    page: params.page, page_size: params.page_size,
    unidad: params.unidad, residente: params.residente,
    estado: params.estado, tipo: params.tipo, is_active: params.is_active,
    search: params.search, ordering: params.ordering, fecha: params.fecha,
  }));
  const r = await fetch(url, { headers: authHeaders() });
  const d = await safeJson(r);
  if (!r.ok) throw d;
  return d;
}

export async function createInfraccion(payload) {
  const r = await fetch(u("infracciones/"), {
    method: "POST", headers: authHeaders(), body: JSON.stringify(payload)
  });
  const d = await safeJson(r); if (!r.ok) throw d; return d;
}

export async function updateInfraccion(id, payload) {
  const r = await fetch(u(`infracciones/${id}/`), {
    method: "PATCH", headers: authHeaders(), body: JSON.stringify(payload)
  });
  const d = await safeJson(r); if (!r.ok) throw d; return d;
}

export async function deleteInfraccion(id) {
  const r = await fetch(u(`infracciones/${id}/`), { method: "DELETE", headers: authHeaders() });
  if (!r.ok && r.status !== 204) throw await safeJson(r);
  return true;
}

export async function resolverInfraccion(id) {
  const r = await fetch(u(`infracciones/${id}/resolver/`), { method: "POST", headers: authHeaders() });
  const d = await safeJson(r); if (!r.ok) throw d; return d;
}

export async function anularInfraccion(id) {
  const r = await fetch(u(`infracciones/${id}/anular/`), { method: "POST", headers: authHeaders() });
  const d = await safeJson(r); if (!r.ok) throw d; return d;
}
