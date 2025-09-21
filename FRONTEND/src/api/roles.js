// src/api/roles.js
const RAW_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";
const BASE = RAW_BASE.endsWith("/") ? RAW_BASE : RAW_BASE + "/";

// Helper para unir paths sin duplicar slash
const u = (path) => `${BASE}${path}`; // path sin slash inicial, ej. 'roles/'

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}), // usa Bearer si tu backend es JWT
  };
}

async function safeJson(res) {
  try { return await res.json(); } catch { return { detail: res.statusText || "Error" }; }
}

// ---------- ROLES ----------
export async function listRoles(pageUrl) {
  // Si DRF te dio una URL absoluta (next), úsala tal cual; si no, construye con base
  const url = pageUrl || u("roles/");
  const res = await fetch(url, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export async function createRole(payload) {
  const res = await fetch(u("roles/"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export async function updateRole(id, payload) {
  const res = await fetch(u(`roles/${id}/`), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export async function deleteRole(id) {
  const res = await fetch(u(`roles/${id}/`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 204) throw await safeJson(res);
  return true;
}

// ---------- PERMISOS ----------
export async function listPermissions(q = "") {
  // Usa el 2do parámetro de URL() para hacer join seguro con BASE
  const url = new URL("permissions/", BASE);
  if (q) url.searchParams.set("q", q);
  const r = await fetch(url, { headers: authHeaders() });
  const data = await r.json();
  if (!r.ok) throw data;
  return data;
}

export async function getRolePermissions(roleId) {
  const r = await fetch(u(`roles/${roleId}/permissions/`), { headers: authHeaders() });
  const data = await r.json();
  if (!r.ok) throw data;
  return data;
}

export async function addRolePermissions(roleId, ids) {
  const r = await fetch(u(`roles/${roleId}/add-permissions/`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ permission_ids: ids }),
  });
  const data = await r.json();
  if (!r.ok) throw data;
  return data;
}

export async function removeRolePermissions(roleId, ids) {
  const r = await fetch(u(`roles/${roleId}/remove-permissions/`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ permission_ids: ids }),
  });
  const data = await r.json();
  if (!r.ok) throw data;
  return data;
}
