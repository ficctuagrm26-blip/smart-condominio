// src/api/roles.js
const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
}

// Listar roles (acepta pageUrl de DRF para paginación)
export async function listRoles(pageUrl) {
  const url = pageUrl || `${BASE}/roles/`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw await res.json();
  return res.json(); // {count, next, previous, results:[...] }
}

export async function createRole(payload) {
  // payload: { code, name, description? }
  const res = await fetch(`${BASE}/roles/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function updateRole(id, payload) {
  const res = await fetch(`${BASE}/roles/${id}/`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function deleteRole(id) {
  const res = await fetch(`${BASE}/roles/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 204) throw await res.json();
  return true;
}
