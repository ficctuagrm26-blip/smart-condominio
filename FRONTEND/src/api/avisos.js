// src/api/avisos.js
import api from "./auth";

// Base sin slash inicial (Axios ya pone BASE en api)
const BASE = "avisos/";
const UNIDADES_BASE = "unidades/";
const ROLES_BASE = "roles/";

// Desempaqueta: si viene paginado {results: []} devuelve el array, si no, el objeto.
function unwrap(data) {
  return Array.isArray(data) ? data : data.results || data;
}

// ------- Avisos -------
export async function listAvisos(params = {}, pageUrl) {
  const { data } = pageUrl
    ? await api.get(pageUrl) // navegar con next/prev absolutos (si luego agregas paginación en UI)
    : await api.get(BASE, { params }); // /avisos/?search=...&ordering=...
  return unwrap(data);
}

export async function getAviso(id) {
  const { data } = await api.get(`${BASE}${id}/`);
  return data;
}

export async function createAviso(payload) {
  const { data } = await api.post(BASE, payload);
  return data;
}

export async function updateAviso(id, payload) {
  const { data } = await api.patch(`${BASE}${id}/`, payload);
  return data;
}

export async function deleteAviso(id) {
  await api.delete(`${BASE}${id}/`);
  return true;
}

export async function publicarAviso(id) {
  const { data } = await api.post(`${BASE}${id}/publicar/`);
  return data;
}

export async function archivarAviso(id) {
  const { data } = await api.post(`${BASE}${id}/archivar/`);
  return data;
}

// ------- Combos -------
export async function listUnidades(params = {}) {
  const { data } = await api.get(UNIDADES_BASE, { params });
  return unwrap(data);
}

export async function listRoles(params = {}) {
  const { data } = await api.get(ROLES_BASE, { params });
  return unwrap(data);
}
