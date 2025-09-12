import { useEffect, useState } from "react";
import api from "../api";
import { useNavigate, Link } from "react-router-dom";

export default function Dashboard() {
  const [me, setMe] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) return navigate("/signin");

    // intenta usar cache local
    const cached = localStorage.getItem("me");
    if (cached) setMe(JSON.parse(cached));
    // refresca datos
    api.get("/api/me/").then(res => {
      setMe(res.data);
      localStorage.setItem("me", JSON.stringify(res.data));
    }).catch(() => navigate("/signin"));
  }, [navigate]);

  if (!me) return null;

  return (
    <div className="container" style={{display:"grid", gap:16}}>
      <h1 style={{marginBottom:8}}>Dashboard</h1>
      <p style={{opacity:.8, marginBottom:16}}>Hola, {me.username} — Rol: {me.role}</p>

      {/* Tarjetas según rol */}
      {me.role === "ADMIN" && (
        <section style={{display:"grid", gap:12}}>
          <h2>Panel de Administrador</h2>
          <div style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))"}}>
            <Card title="Anuncios">
              <p>Publica comunicados para todos los residentes.</p>
              <Link to="/announcements"><button>Gestionar</button></Link>
            </Card>
            <Card title="Tickets">
              <p>Revisa y asigna solicitudes de mantenimiento.</p>
              <Link to="/tickets"><button>Ver tickets</button></Link>
            </Card>
            <Card title="Cuotas">
              <p>Genera y controla estados de pago mensuales.</p>
              <Link to="/invoices"><button>Ver cuotas</button></Link>
            </Card>
            <Card title="Usuarios">
              <p>Crea personal, cambia roles y acceso.</p>
              <Link to="/users"><button>Gestionar usuarios</button></Link>
            </Card>
          </div>
        </section>
      )}

      {me.role === "STAFF" && (
        <section style={{display:"grid", gap:12}}>
          <h2>Panel de Personal</h2>
          <div style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))"}}>
            <Card title="Tickets asignados">
              <p>Trabaja en las solicitudes en curso.</p>
              <Link to="/tickets"><button>Mis tickets</button></Link>
            </Card>
            <Card title="Anuncios">
              <p>Consulta comunicados recientes.</p>
              <Link to="/announcements"><button>Ver anuncios</button></Link>
            </Card>
          </div>
        </section>
      )}

      {me.role === "RESIDENT" && (
        <section style={{display:"grid", gap:12}}>
          <h2>Panel de Residente</h2>
          <div style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))"}}>
            <Card title="Mis pagos">
              <p>Revisa tus cuotas y su estado.</p>
              <Link to="/invoices"><button>Ver pagos</button></Link>
            </Card>
            <Card title="Tickets de mantenimiento">
              <p>Reporta problemas y sigue su estado.</p>
              <Link to="/tickets"><button>Mis tickets</button></Link>
            </Card>
            <Card title="Anuncios">
              <p>Lee comunicados del condominio.</p>
              <Link to="/announcements"><button>Ver anuncios</button></Link>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{
      border:"1px solid rgba(255,255,255,.1)",
      borderRadius:16,
      padding:16,
      background:"rgba(255,255,255,.03)"
    }}>
      <h3 style={{marginBottom:8}}>{title}</h3>
      <div style={{display:"grid", gap:8}}>{children}</div>
    </div>
  );
}
