import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout, getRole } from "../api/auth";
import "../styles.css";

export default function Layout() {
  const navigate = useNavigate();

  let me = null;
  try { me = JSON.parse(localStorage.getItem("me") || "null"); } catch {}
  const role = getRole(me);

  const [openGestion, setOpenGestion] = useState(true);

  const onLogout = () => {
    logout();
    navigate("/signin", { replace: true });
  };

  return (
    <div className="layout">
      <aside className="sidebar" aria-label="Barra lateral de navegación">
        <h3>Smart Condo</h3>

        <nav className="nav">
          <NavLink to="/dashboard" className={({isActive}) => isActive ? "nav__link active" : "nav__link"}>
            Dashboard
          </NavLink>

          <NavLink to="/me" className={({isActive}) => isActive ? "nav__link active" : "nav__link"}>
            Mi Perfil
          </NavLink>

          {/* MÓDULOS: solo muestra “Gestión” si es ADMIN */}
          {role === "ADMIN" && (
            <div className="nav-group">
              <button
                className="nav-group__header"
                onClick={() => setOpenGestion((v) => !v)}
                aria-expanded={openGestion}
                aria-controls="grupo-gestion"
              >
                <span>Gestión</span>
                <span className={`chev ${openGestion ? "open" : ""}`} aria-hidden>▸</span>
              </button>

              <div id="grupo-gestion" className={`nav-group__items ${openGestion ? "open" : ""}`}>
                <NavLink
                  to="/admin/usuarios"
                  className={({isActive}) => isActive ? "nav__sublink active" : "nav__sublink"}
                >
                  Usuarios
                </NavLink>
                {/* Aquí podrás ir sumando más submódulos: */}
                {/* <NavLink to="/admin/personal" className={({isActive}) => isActive ? "nav__sublink active" : "nav__sublink"}>Personal</NavLink> */}
              </div>
            </div>
          )}
        </nav>

        <div className="spacer" />

        <div className="userbox">
          <small>{me?.username} <span className="badge">{role}</span></small>
          <button onClick={onLogout}>Salir</button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
