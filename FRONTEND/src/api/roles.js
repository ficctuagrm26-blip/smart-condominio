// src/api/roles.js
const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

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

// ---------- ROLES ----------
export async function listRoles(pageUrl) {
  const url = pageUrl || `${BASE}/roles/`;
  const res = await fetch(url, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw data;
  return data; // {count,next,previous,results:[...] }
}

export async function createRole(payload) {
  const res = await fetch(`${BASE}/roles/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export async function updateRole(id, payload) {
  const res = await fetch(`${BASE}/roles/${id}/`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export async function deleteRole(id) {
  const res = await fetch(`${BASE}/roles/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 204) throw await safeJson(res);
  return true;
}

// ---------- PERMISOS ----------
export async function listPermissions(q = "") {
  const url = new URL(`${BASE}/permissions/`);
  if (q) url.searchParams.set("q", q);
  const r = await fetch(url, { headers: authHeaders() });
  const data = await r.json();
  if (!r.ok) throw data;
  return data; // {count,next,previous,results:[...]}
}

export async function getRolePermissions(roleId) {
  const r = await fetch(`${BASE}/roles/${roleId}/permissions/`, { headers: authHeaders() });
  const data = await r.json();
  if (!r.ok) throw data;
  return data; // [{id,codename,name,content_type}]
}

export async function addRolePermissions(roleId, ids) {
  const r = await fetch(`${BASE}/roles/${roleId}/add-permissions/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ permission_ids: ids }),
  });
  const data = await r.json();
  if (!r.ok) throw data;
  return data;
}

export async function removeRolePermissions(roleId, ids) {
  const r = await fetch(`${BASE}/roles/${roleId}/remove-permissions/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ permission_ids: ids }),
  });
  const data = await r.json();
  if (!r.ok) throw data;
  return data;
}
