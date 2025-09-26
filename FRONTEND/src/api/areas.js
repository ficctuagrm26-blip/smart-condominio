// src/api/areas.js
// API de Áreas Comunes (CATÁLOGO), Reglas (CU19), Disponibilidad (CU16) y Reservas (CU17)

import { api } from "./auth";

/* ==================== ÁREAS ==================== */
export async function listAreas(params = {}) {
  const { data } = await api.get("/areas-comunes/", { params });
  return Array.isArray(data) ? data : data.results || [];
}
export async function createArea(payload) {
  const { data } = await api.post("/areas-comunes/", payload);
  return data;
}
export async function updateArea(id, partial) {
  const { data } = await api.patch(`/areas-comunes/${id}/`, partial);
  return data;
}
export async function deleteArea(id) {
  const { data } = await api.delete(`/areas-comunes/${id}/`);
  return data;
}

/* ==================== DISPONIBILIDAD (CU16) ==================== */
/**
 * GET /areas-comunes/:id/disponibilidad/?date=YYYY-MM-DD&slot=60&from=HH:MM&to=HH:MM
 * Devuelve: { area_id, date, slot_minutes, windows:[{start:'HH:MM',end:'HH:MM'}], slots:[{start,end}] }
 */
export async function getDisponibilidad(areaId, params) {
  const { data } = await api.get(`/areas-comunes/${areaId}/disponibilidad/`, {
    params,
  });
  return data;
}

/* ==================== REGLAS (CU19) ==================== */
// Ajusta el endpoint si en tu backend le diste otro nombre
const RULES_ENDPOINT = "/areas-disponibilidad/";

export const DIA_CHOICES = [
  { value: 0, label: "Lunes" },
  { value: 1, label: "Martes" },
  { value: 2, label: "Miércoles" },
  { value: 3, label: "Jueves" },
  { value: 4, label: "Viernes" },
  { value: 5, label: "Sábado" },
  { value: 6, label: "Domingo" },
];

export async function listReglas(params = {}) {
  // params: { area?, dia_semana? }
  const { data } = await api.get(RULES_ENDPOINT, { params });
  return Array.isArray(data) ? data : data.results || [];
}
export async function createRegla(payload) {
  // payload: { area, dia_semana, hora_inicio, hora_fin, max_horas_por_reserva }
  const { data } = await api.post(RULES_ENDPOINT, payload);
  return data;
}
export async function updateRegla(id, partial) {
  const { data } = await api.patch(`${RULES_ENDPOINT}${id}/`, partial);
  return data;
}
export async function deleteRegla(id) {
  const { data } = await api.delete(`${RULES_ENDPOINT}${id}/`);
  return data;
}

/* ==================== RESERVAS (CU17) ==================== */
const RESERVAS_ENDPOINT = "/reservas-area/";

/**
 * Crea una reserva:
 *  { area, unidad?, fecha_inicio: ISOString, fecha_fin: ISOString, nota? }
 */
export async function createReserva(payload) {
  const { data } = await api.post(RESERVAS_ENDPOINT, payload);
  return data;
}

/**
 * Lista reservas (filtrables)
 * params soportados (según backend): { area?, date_from?, date_to? }
 */
export async function listReservas(params = {}) {
  const { data } = await api.get(RESERVAS_ENDPOINT, { params });
  return Array.isArray(data) ? data : data.results || [];
}

/** Atajo: lista reservas por área y rango de fechas */
export async function listReservasByArea(areaId, { date_from, date_to } = {}) {
  const params = { area: areaId, date_from, date_to };
  return await listReservas(params);
}

export async function updateReserva(reservaId, partial) {
  const { data } = await api.patch(
    `${RESERVAS_ENDPOINT}${reservaId}/`,
    partial
  );
  return data;
}
export async function cancelarReserva(reservaId) {
  const { data } = await api.post(`${RESERVAS_ENDPOINT}${reservaId}/cancelar/`);
  return data;
}
