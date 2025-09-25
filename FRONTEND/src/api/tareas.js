// src/api/tareas.js
import api from "./auth";

// -------- CRUD / listing --------
export const listTasks = (params = {}) =>
  api.get("tareas/", { params }).then((r) => r.data.results ?? r.data);

export const getTask = (id) => api.get(`tareas/${id}/`).then((r) => r.data);

export const createTask = (data) =>
  api.post("tareas/", data).then((r) => r.data);

export const updateTask = (id, data) =>
  api.patch(`tareas/${id}/`, data).then((r) => r.data);

export const deleteTask = (id) =>
  api.delete(`tareas/${id}/`).then((r) => r.data);

// -------- acciones CU24 --------
export const assignTask = (id, payload) =>
  api.post(`tareas/${id}/asignar/`, payload).then((r) => r.data);

export const takeTask = (id) =>
  api.post(`tareas/${id}/tomar/`).then((r) => r.data);

export const changeTaskState = (id, estado) =>
  api.post(`tareas/${id}/cambiar_estado/`, { estado }).then((r) => r.data);

export const commentTask = (id, cuerpo) =>
  api.post(`tareas/${id}/comentar/`, { cuerpo }).then((r) => r.data);

// -------- catálogos auxiliares --------
export const listRoles = () => api.get("roles/").then((r) => r.data);

export const listUsers = (params = {}) =>
  api.get("admin/users/", { params }).then((r) => r.data.results ?? r.data);

export const listUnidades = (params = {}) =>
  api.get("unidades/", { params }).then((r) => r.data.results ?? r.data);
