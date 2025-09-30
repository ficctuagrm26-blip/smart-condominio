// src/api/access.js
import api from "./auth";

export async function listAccessEvents(params = {}) {
  const { data } = await api.get("access/events/", { params });
  return Array.isArray(data) ? data : data.results || data;
}

export function exportAccessCSV(params = {}) {
  const url = new URL(api.defaults.baseURL + "access/events/export/");
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  window.location.href = url.toString();
}
