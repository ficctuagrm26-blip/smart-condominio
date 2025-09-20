import axios from "axios";


const RAW_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";
// Normaliza: garantiza que termine en '/'
const BASE = RAW_BASE.endsWith("/") ? RAW_BASE : RAW_BASE + "/";


const LOGIN_PATH = import.meta.env.VITE_API_LOGIN_PATH || "auth/login/";
const ME_PATH = import.meta.env.VITE_API_ME_PATH || "auth/me/";
const ME_UPDATE_PATH = import.meta.env.VITE_API_UPDATE_PATH || "auth/me/update/";
const CHANGE_PASSWORD = "auth/change-password/"

//CLIENTE AXIOS
export const api = axios.create({
  baseURL: BASE, // BASE ya normalizado con trailing slash
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

//FUNCION TOKEN
export function setAuthToken(token) {
if (token) { //SI HAY TOKEN
localStorage.setItem("token", token);//GUARDA EN LOCALSTORAGE
api.defaults.headers.common.Authorization = `Token ${token}`; // DRF TokenAuth LO AGREGA AL HEADER AUTHORIZATION
} else { //SI NO HAY TOKEN LOS REMUEVE DE LOCAL Y HEADER
localStorage.removeItem("token");
delete api.defaults.headers.common.Authorization;
}
}


// Si hay token guardado, lo cargamos al iniciar.
const saved = localStorage.getItem("token");
if (saved) setAuthToken(saved);



// 🔎 logea cada request para verificar la URL final
api.interceptors.request.use((cfg) => {
  const full = new URL(cfg.url ?? "", cfg.baseURL ?? window.location.origin).toString();
  console.log("[REQUEST]", full, cfg.params);
  return cfg;
});
// Limpieza automática si el backend responde 401

api.interceptors.response.use(
(r) => r,
(error) => {
if (error?.response?.status === 401) {
setAuthToken(null);
localStorage.removeItem("me");
}
return Promise.reject(error);
}
);

//POST MANDA CREDENCIALES AL ENDPOINT 
export async function login(username, password) {
const { data } = await api.post(LOGIN_PATH, { username, password });
const token = data?.token || data?.key || data?.values?.token || data?.values?.key;
//SI NO HAY TOKEN
if (!token) throw new Error("No se recibió token desde el backend");
//SI HAY LO GUARDA Y CONFIGURA EL HEADER
setAuthToken(token);
return { token };
}

//GET LLAMA AL ENDPOINT Y DEVUELVE EL USUARIO SOLO SI EL HEADER, AUTHORIZATION YA FUE SETEADO
export async function me() {
const { data } = await api.get(ME_PATH);
return data; // { id, username, role/rol/rolNombre, ... }
}
//METODO PARA ACTUALIZAR EL PERFIL
export async function updateMe(payload) {
const { data } = await api.patch(ME_UPDATE_PATH,payload);
  return data;
}

//METODO PARA ACTUALIZAR LA CONTRASEÑA DEL PERFIL 
export async function changePassword({ current_password, new_password}) {
  const { data } = await api.post(CHANGE_PASSWORD, { current_password, new_password});
  return data;
}


//LIMPIA EL TOKEN, HEADER Y CACHE
export function logout() {
setAuthToken(null);
localStorage.removeItem("me");
}

export default api;

export const ROLES = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  RESIDENT: "RESIDENT",
};

export function getRole(obj) {
  const raw =
    obj?.role ??
    obj?.rol ??
    obj?.rolNombre ??
    obj?.profile?.role ??
    null;

  if (typeof raw !== "string") return null;
  const r = raw.trim().toUpperCase();

  const map = {
    ADMIN: "ADMIN",
    ADMINISTRADOR: "ADMIN",
    STAFF: "STAFF",
    PERSONAL: "PERSONAL",
    RESIDENT: "RESIDENTE",
    RESIDENTE: "RESIDENTE",
    CLIENT: "CLIENTE",
    CLIENTE: "CLIENTE",
  };
  return map[r] ?? r;
}

//API DE USUARIOS
const USERS_BASE = import.meta.env.VITE_API_USERS_PATH ?? "admin/users/";

// Normaliza el payload: quita vacíos y no envía password si no se cambió
function cleanUserPayload(input, isCreate = false) {
  const p = { ...input };

  // strings vacíos -> fuera
  for (const k of ["email", "first_name", "last_name"]) {
    if (!p[k]) delete p[k];
  }

  // si no quieres cambiar contraseña en edición, no la mandes
  if (!isCreate && !p.password) delete p.password;

  // rol esperado como string: "ADMIN" | "PERSONAL" | "RESIDENTE"
  if (typeof p.role === "string" && p.role.trim()) {
  const out = p.role.trim().toUpperCase();
  const mapOut = { PERSONAL: "STAFF", RESIDENTE: "RESIDENT" };
  p.role_input = mapOut[out] || out; // ADMIN se mantiene
  delete p.role;
  }

  return p;
}

export async function listUsers(params = {}) {
  // soporta paginado DRF (results) o lista directa
  const { data } = await api.get(USERS_BASE, { params });
  return Array.isArray(data) ? data : (data.results || data);
}

export async function createUser(payload) {
  const { data } = await api.post(USERS_BASE, cleanUserPayload(payload, true));
  return data;
}

export async function updateUser(id, payload) {
  const { data } = await api.patch(`${USERS_BASE}${id}/`, cleanUserPayload(payload, false));
  return data;
}

export async function deleteUser(id) {
  await api.delete(`${USERS_BASE}${id}/`);
}
