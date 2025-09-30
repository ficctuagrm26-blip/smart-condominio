// src/api/vehiculos.js
import api from "./auth";

export const VEHICULOS_BASE = "vehiculos/";
export const SOLICITUDES_BASE = "solicitudes-vehiculo/";

// --------- Normalizadores ---------
export const VEHICULO_TIPO_CHOICES = [
  { value: "AUTO", label: "Auto" },
  { value: "MOTO", label: "Moto" },
  { value: "CAMIONETA", label: "Camioneta" },
  { value: "OTRO", label: "Otro" },
];

export function serializeSolicitudVehiculoPayload(input = {}) {
  const {
    placa = "",
    marca = "",
    modelo = "",
    color = "",
    tipo = "AUTO",
    foto_placa = null,
    documento = null,
  } = input;

  const fd = new FormData();
  if (placa) fd.append("placa", placa.trim().toUpperCase());
  if (marca) fd.append("marca", marca.trim());
  if (modelo) fd.append("modelo", modelo.trim());
  if (color) fd.append("color", color.trim());
  if (tipo) fd.append("tipo", tipo);
  if (foto_placa instanceof File) fd.append("foto_placa", foto_placa);
  if (documento instanceof File) fd.append("documento", documento);
  return fd;
}

// --------- API: Vehículos ---------
export async function listVehiculos(params = {}) {
  const { data } = await api.get(VEHICULOS_BASE, { params });
  return Array.isArray(data) ? data : data.results || data;
}

export async function getVehiculo(id) {
  const { data } = await api.get(`${VEHICULOS_BASE}${id}/`);
  return data;
}

export async function updateVehiculo(id, payload) {
  const { data } = await api.patch(`${VEHICULOS_BASE}${id}/`, payload);
  return data;
}

// --------- API: Solicitudes ---------
export async function listSolicitudesVehiculo(params = {}) {
  const { data } = await api.get(SOLICITUDES_BASE, { params });
  return Array.isArray(data) ? data : data.results || data;
}

export async function createSolicitudVehiculo(payload = {}) {
  const form =
    payload instanceof FormData
      ? payload
      : serializeSolicitudVehiculoPayload(payload);
  const { data } = await api.post(SOLICITUDES_BASE, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/**
 * Revisar una solicitud (ADMIN/STAFF).
 * @param {number|string} id
 * @param {{ accion: 'aprobar'|'rechazar', observaciones?: string, unidad?: number|string|null }} params
 */
export async function reviewSolicitudVehiculo(
  id,
  { accion, observaciones = "", unidad = null } = {}
) {
  const qs = unidad ? `?unidad=${encodeURIComponent(unidad)}` : "";
  const { data } = await api.post(`${SOLICITUDES_BASE}${id}/review/${qs}`, {
    accion,
    observaciones: observaciones || "",
  });
  return data;
}
// Residente cancela su propia solicitud (PENDIENTE)
export async function cancelSolicitudVehiculo(id, observaciones = "") {
  const { data } = await api.post(`${SOLICITUDES_BASE}${id}/cancelar/`, {
    observaciones: observaciones || "",
  });
  return data;
}
