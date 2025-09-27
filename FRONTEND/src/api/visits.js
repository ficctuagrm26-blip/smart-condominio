// src/api/visits.js
import api from "./auth";

const VISITS_BASE = "visits/"; // sin slash inicial, igual que UNITS_BASE

// ---------- Utils opcionales ----------
/**
 * Normaliza filtros típicos para la lista.
 * Ej: buildVisitQuery({ q:"juan", status:"REGISTRADO", ordering:"-created_at", page:1, page_size:20 })
 */
export function buildVisitQuery({
  q = "",
  status = "",
  unit = "",
  host_resident = "",
  ordering = "-created_at",
  page = 1,
  page_size = 20,
} = {}) {
  const params = {};
  if (q) params.search = q;
  if (status) params.status = status;
  if (unit) params.unit = unit;
  if (host_resident) params.host_resident = host_resident;
  if (ordering) params.ordering = ordering;
  if (page) params.page = page;
  if (page_size) params.page_size = page_size;
  return params;
}

/**
 * Arma el payload esperado por el backend para crear/editar visitas.
 * Acepta tanto visitor embebido como campos sueltos y los compacta.
 */
export function serializeVisitPayload({
  // visitante
  visitor_full_name,
  visitor_doc_type = "CI",
  visitor_doc_number,
  visitor_phone = "",
  visitor, // si ya viene como objeto { full_name, doc_type, doc_number, phone }

  // visita
  unit,
  host_resident,
  vehicle_plate = "",
  purpose = "",
  scheduled_for = null, // ISO string o null
  notes = "",
  ...rest // por si hay extras
} = {}) {
  const v =
    visitor ||
    {
      full_name: visitor_full_name,
      doc_type: visitor_doc_type || "CI",
      doc_number: visitor_doc_number,
      phone: visitor_phone || "",
    };

  return {
    visitor: v,
    unit,
    host_resident,
    vehicle_plate: vehicle_plate?.trim(),
    purpose: purpose?.trim(),
    scheduled_for: scheduled_for || null,
    notes: notes?.trim(),
    ...rest,
  };
}

// ---------- API calls ----------

/**
 * Lista visitas. Devuelve array si el backend no pagina, o data.results si está paginado.
 * Pasa tal cual los params (usa buildVisitQuery si quieres helpers).
 */
export async function listVisits(params = {}) {
  const { data } = await api.get(VISITS_BASE, { params });
  return Array.isArray(data) ? data : (data.results || data);
}

export async function getVisit(id) {
  const { data } = await api.get(`${VISITS_BASE}${id}/`);
  return data;
}

export async function createVisit(payload) {
  // payload debe incluir { visitor: {full_name, doc_type, doc_number, phone}, unit, host_resident, ... }
  const { data } = await api.post(VISITS_BASE, payload);
  return data;
}

export async function updateVisit(id, payload) {
  const { data } = await api.patch(`${VISITS_BASE}${id}/`, payload);
  return data;
}

export async function deleteVisit(id) {
  await api.delete(`${VISITS_BASE}${id}/`);
}

// ---------- Acciones de flujo ----------
export async function enterVisit(id) {
  const { data } = await api.post(`${VISITS_BASE}${id}/enter/`);
  return data;
}

export async function exitVisit(id) {
  const { data } = await api.post(`${VISITS_BASE}${id}/exit/`);
  return data;
}

export async function cancelVisit(id) {
  const { data } = await api.post(`${VISITS_BASE}${id}/cancel/`);
  return data;
}

export async function denyVisit(id) {
  const { data } = await api.post(`${VISITS_BASE}${id}/deny/`);
  return data;
}
