// src/api/areas.js
// API de Áreas Comunes (CATÁLOGO), Reglas (CU19), Disponibilidad (CU16) y Reservas (CU17)

import { api } from "./auth";

/* ==================== ÁREAS ==================== */
export async function listAreas(params = {}) {
  const { data } = await api.get("/areas-comunes/", { params });
  // soporta: array directo, paginado DRF, o {status, values}
  const payload = data?.values ?? data;
  if (Array.isArray(payload)) return payload;
  return payload?.results || payload?.items || [];
}
export async function createArea(payload) {
  const { data } = await api.post("/areas-comunes/", payload);
  return data?.values ?? data;
}
export async function updateArea(id, partial) {
  const { data } = await api.patch(`/areas-comunes/${id}/`, partial);
  return data?.values ?? data;
}
export async function deleteArea(id) {
  const { data } = await api.delete(`/areas-comunes/${id}/`);
  return data?.values ?? data;
}

/* ==================== DISPONIBILIDAD (CU16) ==================== */
/**
 * GET /areas-comunes/:id/disponibilidad/?date=YYYY-MM-DD&slot=60&from=HH:MM&to=HH:MM
 * Devuelve: { area_id, date, slot_minutes, windows:[{start,end}], slots:[{start,end}] }
 */
export async function getDisponibilidad(areaId, params) {
  const { data } = await api.get(`/areas-comunes/${areaId}/disponibilidad/`, {
    params,
  });
  const d = data?.values ?? data ?? {};
  return {
    area_id: d.area_id ?? areaId,
    date: d.date,
    slot_minutes: d.slot_minutes ?? Number(params?.slot) || 60,
    windows: Array.isArray(d.windows) ? d.windows : [],
    slots: Array.isArray(d.slots) ? d.slots : [],
  };
}

/* ==================== REGLAS (CU19) ==================== */
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
  const { data } = await api.get(RULES_ENDPOINT, { params });
  const payload = data?.values ?? data;
  if (Array.isArray(payload)) return payload;
  return payload?.results || payload?.items || [];
}
export async function createRegla(payload) {
  const { data } = await api.post(RULES_ENDPOINT, payload);
  return data?.values ?? data;
}
export async function updateRegla(id, partial) {
  const { data } = await api.patch(`${RULES_ENDPOINT}${id}/`, partial);
  return data?.values ?? data;
}
export async function deleteRegla(id) {
  const { data } = await api.delete(`${RULES_ENDPOINT}${id}/`);
  return data?.values ?? data;
}

/* ==================== RESERVAS (CU17) ==================== */
const RESERVAS_ENDPOINT = "/reservas-area/";

export async function createReserva(payload) {
  const { data } = await api.post(RESERVAS_ENDPOINT, payload);
  return data?.values ?? data;
}

export async function listReservas(params = {}) {
  const { data } = await api.get(RESERVAS_ENDPOINT, { params });
  const payload = data?.values ?? data;
  if (Array.isArray(payload)) return payload;
  return payload?.results || payload?.items || [];
}

export async function listReservasByArea(areaId, { date_from, date_to } = {}) {
  return await listReservas({ area: areaId, date_from, date_to });
}

export async function updateReserva(reservaId, partial) {
  const { data } = await api.patch(`${RESERVAS_ENDPOINT}${reservaId}/`, partial);
  return data?.values ?? data;
}
export async function cancelarReserva(reservaId) {
  const { data } = await api.post(`${RESERVAS_ENDPOINT}${reservaId}/cancelar/`);
  return data?.values ?? data;
}
