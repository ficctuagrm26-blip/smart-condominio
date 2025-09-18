// src/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ||  "http://127.0.0.1:8000", // o http://localhost:8000
});

// 📤 Adjunta el token en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 📥 Si el back responde 401, limpia y manda al /signin
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("me");

      // evita loop si ya estás en /signin
      if (window.location.pathname !== "/signin") {
        // replace para no dejar el historial sucio
        window.location.replace("/signin");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
