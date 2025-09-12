import { useEffect, useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const navigate = useNavigate();

  // 👉 Aquí defines la función logout
  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    navigate("/signin");
  };

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) return navigate("/signin");

    api.get("/api/tasks/")
      .then(res => setTasks(res.data))
      .catch(() => navigate("/signin"));
  }, [navigate]);

  return (
    <div style={{padding:24}}>
      <h1>Mis Tareas</h1>

      {/* 👉 Botón de logout */}
      <button onClick={logout} style={{marginBottom:16, padding:8, background:"red", color:"white"}}>
        Cerrar sesión
      </button>

      <ul>
        {tasks.map(t => (
          <li key={t.id}>
            <strong>{t.title}</strong> - {t.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
