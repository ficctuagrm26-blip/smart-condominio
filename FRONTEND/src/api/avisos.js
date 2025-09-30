// src/api/avisos.js
import api from "./auth";

// Bases sin slash inicial (el baseURL ya termina en "/")
const PUBLIC_BASE = "avisos/";
const ADMIN_BASE  = "admin/avisos/";

// ===== Público (residentes) =====
export async function listAvisosPublic(params = {}) {
  const { data } = await api.get(PUBLIC_BASE, { params });
  return Array.isArray(data) ? data : (data.results || data);
}

export async function getAvisoPublic(id) {
  const { data } = await api.get(`${PUBLIC_BASE}${id}/`);
  return data;
}

// ===== Admin (CRUD + acciones) =====
export async function listAvisos(params = {}) {
  const { data } = await api.get(ADMIN_BASE, { params });
  return Array.isArray(data) ? data : (data.results || data);
}

export async function createAviso(payload) {
  // payload puede traer publish_at/expires_at en ISO o null
  const { data } = await api.post(ADMIN_BASE, payload);
  return data;
}

export async function updateAviso(id, payload) {
  const { data } = await api.patch(`${ADMIN_BASE}${id}/`, payload);
  return data;
}

export async function deleteAviso(id) {
  await api.delete(`${ADMIN_BASE}${id}/`);
}

export async function publicarAviso(id) {
  const { data } = await api.post(`${ADMIN_BASE}${id}/publicar/`);
  return data;
}

export async function archivarAviso(id) {
  const { data } = await api.post(`${ADMIN_BASE}${id}/archivar/`);
  return data;
}
