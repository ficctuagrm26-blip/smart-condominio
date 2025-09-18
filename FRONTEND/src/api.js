// src/api.js
import axios from "axios";

// Acepta cualquiera de las 2 env vars y asegura terminar en /api/
const RAW_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api/";

const BASE = RAW_BASE.endsWith("/api/")
  ? RAW_BASE
  : `${RAW_BASE.replace(/\/$/, "")}/api/`;

export const api = axios.create({ baseURL: BASE });

/* -------------------------
   Helpers de sesión
------------------------- */

// Guarda / quita el token en localStorage y en axios
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem("token", token);
    api.defaults.headers.common.Authorization = `Token ${token}`;
  } else {
    localStorage.removeItem("token");
    delete api.defaults.headers.common.Authorization;
  }
}

// Mantén la sesión al recargar
const saved = localStorage.getItem("token");
if (saved) setAuthToken(saved);

// Login (obtén token del backend)
export async function login(username, password) {
  const { data } = await api.post("auth/login/", { username, password });
  // data = { token: "..." }
  setAuthToken(data.token);
  return data;
}

// Cierra sesión en el cliente
export function logout() {
  setAuthToken(null);
  localStorage.removeItem("me");
}

// Quién soy (requiere token)
export async function me() {
  const { data } = await api.get("auth/me/");
  // opcional: cachea para tu RequireAuth/RequireRole
  localStorage.setItem("me", JSON.stringify(data));
  return data; // { id, username, email, first_name, last_name, role }
}

/* -------------------------
   Interceptores
------------------------- */

// Adjunta token a cada request (por si no usaste setAuthToken())
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

// Si backend responde 401, limpia sesión y redirige a /signin
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      setAuthToken(null);
      localStorage.removeItem("me");
      if (window.location.pathname !== "/signin") {
        window.location.replace("/signin");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
