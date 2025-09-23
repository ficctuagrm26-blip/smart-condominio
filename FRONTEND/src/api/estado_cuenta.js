// src/api/estado_cuenta.js
const RAW_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";
const BASE = RAW_BASE.endsWith("/") ? RAW_BASE : RAW_BASE + "/";
const u = (p) => `${BASE}${p}`;

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Token ${token}` } : {};
}

async function safeJson(res) {
  try { return await res.json(); } catch { return { detail: res.statusText || "Error" }; }
}

export async function getEstadoCuenta(unidadId) {
  const url = new URL("estado-cuenta/", BASE);
  if (unidadId) url.searchParams.set("unidad", unidadId);
  const r = await fetch(url, { headers: authHeaders() });
  const d = await safeJson(r);
  if (!r.ok) throw d;
  return d;
}

export async function downloadEstadoCuentaCSV(unidadId) {
  const url = new URL("estado-cuenta/export/", BASE);
  if (unidadId) url.searchParams.set("unidad", unidadId);
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) throw await safeJson(r);
  const blob = await r.blob();
  const a = document.createElement("a");
  const objUrl = URL.createObjectURL(blob);
  a.href = objUrl;
  a.download = "estado_de_cuenta.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(objUrl);
}
