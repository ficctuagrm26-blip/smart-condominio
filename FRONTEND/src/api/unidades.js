// src/api/unidades.js
import api from "./auth";

const UNITS_BASE = "unidades/"; // sin slash inicial

export async function listUnidades(params = {}) {
  const { data } = await api.get(UNITS_BASE, { params });
  return Array.isArray(data) ? data : (data.results || data);
}

export async function getUnidad(id) {
  const { data } = await api.get(`${UNITS_BASE}${id}/`);
  return data;
}

export async function createUnidad(payload) {
  const { data } = await api.post(UNITS_BASE, payload);
  return data;
}

export async function updateUnidad(id, payload) {
  const { data } = await api.patch(`${UNITS_BASE}${id}/`, payload);
  return data;
}

export async function deleteUnidad(id) {
  await api.delete(`${UNITS_BASE}${id}/`);
}

export async function desactivarUnidad(id) {
  const { data } = await api.post(`${UNITS_BASE}${id}/desactivar/`);
  return data;
}

export async function asignarUnidad(id, { propietario = null, residente = null } = {}) {
  const { data } = await api.post(`${UNITS_BASE}${id}/asignar/`, { propietario, residente });
  return data;
}
