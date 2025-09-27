// src/api/staff.js
import api from "./auth";

// --- Helpers ---
function cleanStaffPayload(input, isCreate = false) {
  const p = { ...input };
  // strings vacíos fuera
  for (const k of ["email", "first_name", "last_name", "staff_kind"]) {
    if (p[k] === "" || p[k] == null) delete p[k];
  }
  if (!isCreate && !p.password) delete p.password;

  // Importante: el backend espera role_code (un Rol con base=STAFF)
  if (typeof p.role_code === "string") {
    p.role_code = p.role_code.trim().toUpperCase();
  }

  return p;
}

// --- Roles (para el select de sub-rol) ---
export async function listRoles(params = {}) {
  // /roles/ (los trae todos; filtramos en front por base === "STAFF")
  const { data } = await api.get("roles/", { params });
  return Array.isArray(data) ? data : data.results || data;
}
export async function listStaffRoles() {
  const roles = await listRoles();
  return roles.filter((r) => r.base === "STAFF");
}

// --- STAFF CRUD ---
const STAFF_BASE = "staff/";

export async function listStaff({ search = "", page = 1, page_size = 10 } = {}) {
  const q = (search || "").trim();

  // Enviamos ambos por compatibilidad: DRF (search) o backends que esperan q
  const params = {};
  if (q) { params.search = q; params.q = q; }
  if (page) params.page = page;
  if (page_size) params.page_size = page_size;

  const { data } = await api.get(STAFF_BASE, { params });
  return Array.isArray(data) ? { results: data, count: data.length } : data;
}

export async function createStaff(payload) {
  const { data } = await api.post(STAFF_BASE, cleanStaffPayload(payload, true));
  return data;
}

export async function updateStaff(id, payload) {
  const { data } = await api.patch(
    `${STAFF_BASE}${id}/`,
    cleanStaffPayload(payload, false)
  );
  return data;
}

export async function deleteStaff(id) {
  await api.delete(`${STAFF_BASE}${id}/`);
}
