// src/api/face_access.js
import api from "./auth";

/**
 * Construye query string ignorando vacíos.
 */
function qs(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Lista de AccessEvent (usamos la misma bitácora y filtramos en FE los faciales)
 * params soportados por el backend: from, to, camera_id, decision, direction, opened, plate, min_score
 */
export async function listAccessEvents(params = {}) {
  const { data } = await api.get(`access/events/${qs(params)}`);
  return Array.isArray(data) ? data : data.results || data;
}

/**
 * Exportar CSV en base a los mismos filtros del backend.
 * Ojo: el backend no sabe de “solo facial”, así que exporta todo lo filtrado del servidor.
 * Si necesitas exportar solo facial, habría que añadir un flag servidor.
 */
export function exportAccessCSV(params = {}) {
  const url = `${api.defaults.baseURL}access/events/export/${qs(params)}`;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.click();
}

/**
 * Obtén datos de un usuario (para enriquecer la tabla).
 * Requiere permisos ADMIN/STAFF (tu endpoint admin/users/{id}/).
 */
export async function fetchUserById(id) {
  const { data } = await api.get(`admin/users/${id}/`);
  return data;
}
