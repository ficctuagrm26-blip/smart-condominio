// src/components/Layout.jsx
import { useEffect, useMemo, useState } from "react";
import {
  NavLink,
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "../styles.css";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const me = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("me") || "{}");
    } catch {
      return {};
    }
  }, []);
  const roleCode =
    me?.profile?.role?.code ||
    me?.profile?.role_code ||
    (me?.is_superuser ? "ADMIN" : "");

  const signout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("me");
    navigate("/signin", { replace: true });
  };

  // ====== Estado móvil: sidebar ======
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    // cada navegación cierra el sidebar en móvil
    setSidebarOpen(false);
  }, [location.pathname, location.search]);

  // activos (por ?group=)
  const params = new URLSearchParams(location.search);
  const currentGroup = params.get("group");
  const onUsersPath = location.pathname === "/admin/usuarios";
  const activeUsers = onUsersPath && !currentGroup;
  const activeStaff = onUsersPath && currentGroup === "staff";
  const activeResidents = onUsersPath && currentGroup === "residents";

  // helpers
  const isPath = (p) => location.pathname.startsWith(p);

  // acordeón principal
  const defaultAdminOpen = location.pathname.startsWith("/admin");
  const [adminOpen, setAdminOpen] = useState(defaultAdminOpen);
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) setAdminOpen(true);
  }, [location.pathname]);

  // sub-acordeones (paquetes)
  const [usrOpen, setUsrOpen] = useState(isPath("/admin/usuarios"));
  const [uniOpen, setUniOpen] = useState(isPath("/admin/unidades"));
  const [finOpen, setFinOpen] = useState(
    isPath("/admin/cuotas") || isPath("/admin/pagos")
  );
  const [comOpen, setComOpen] = useState(isPath("/admin/avisos"));
  const [areasOpen, setAreasOpen] = useState(isPath("/admin/areas-comunes"));
  const [tasksOpen, setTasksOpen] = useState(
    isPath("/admin/tareas") || isPath("/admin/asignar-tareas")
  );
  const [segOpen, setSegOpen] = useState(isPath("/admin/infracciones"));
  const [repOpen, setRepOpen] = useState(isPath("/admin/reportes"));

  return (
    <div className={`layout ${sidebarOpen ? "layout--locked" : ""}`}>
      {/* ===== Topbar (móvil) ===== */}
      <header className="topbar">
        <button
          className="hamburger"
          aria-label="Abrir menú"
          onClick={() => setSidebarOpen((v) => !v)}
        >
          ☰
        </button>
        <div className="topbar__title">Smart Condominio</div>
        <div className="topbar__spacer" />
      </header>

      {/* ===== Backdrop móvil ===== */}
      <div
        className={`sidebar__backdrop ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ===== Sidebar ===== */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          Smart Condominio
        </div>

        {/* Contenido desplazable del menú */}
        <div className="sidebar__scroll">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav__link ${isActive ? "active" : ""}`}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/estado-cuenta"
            className={({ isActive }) => `nav__link ${isActive ? "active" : ""}`}
          >
            Estado de cuenta
          </NavLink>
          <NavLink
            to="/areas/disponibilidad"
            className={({ isActive }) => `nav__link ${isActive ? "active" : ""}`}
          >
            Disponibilidad de áreas
          </NavLink>
          <NavLink
            to="/avisos"
            className={({ isActive }) => `nav__link ${isActive ? "active" : ""}`}
          >
            Mis avisos
          </NavLink>
          <NavLink
            to="/tareas"
            className={({ isActive }) => `nav__link ${isActive ? "active" : ""}`}
          >
            Mis tareas
          </NavLink>

          {/* ===== Administración ===== */}
          <div className="nav-group">
            <button
              type="button"
              className="nav-group__header"
              onClick={() => setAdminOpen((v) => !v)}
            >
              <span>GESTIONAR USUARIOS</span>
              <span className={`chev ${adminOpen ? "open" : ""}`}>▸</span>
            </button>
            
            <div className={`nav-group__items ${adminOpen ? "open" : ""}`}>
              {/* ---- Enlace directo ---- */}
              <NavLink
                to="/me"
                className={({ isActive }) =>
                  `nav__sublink ${isActive ? "active" : ""}`
                }
              >
                Gestionar Perfil (CU03)
              </NavLink>
              <NavLink
                to="/admin/usuarios"
                className={({ isActive }) =>
                  `nav__sublink ${isActive ? "active" : ""}`
                }
              >
                Gestionar Usuarios (CU04)
              </NavLink>
              <NavLink
                to="/admin/roles"
                className={({ isActive }) =>
                  `nav__sublink ${isActive ? "active" : ""}`
                }
              >
                Gestionar Roles (CU05)
              </NavLink>
               {/* ---- Gestión de usuarios ---- */}
              <div className="nav__package">
                <button
                  type="button"
                  className="nav-group__header"
                  onClick={() => setUsrOpen((v) => !v)}
                >
                  <span>Gestionar Usuarios (CU04)</span>
                  <span className={`chev ${usrOpen ? "open" : ""}`}>▸</span>
                </button>
                <div className={`nav-group__items ${usrOpen ? "open" : ""}`}>
                  <Link
                    to="/admin/usuarios"
                    className={`nav__sublink ${activeUsers ? "active" : ""}`}
                  >
                    Usuarios
                  </Link>
                  <Link
                    to={{ pathname: "/admin/usuarios", search: "?group=staff" }}
                    className={`nav__sublink ${activeStaff ? "active" : ""}`}
                  >
                    Staff
                  </Link>
                  <Link
                    to={{
                      pathname: "/admin/usuarios",
                      search: "?group=residents",
                    }}
                    className={`nav__sublink ${activeResidents ? "active" : ""}`}
                  >
                    Residentes
                  </Link>
                </div>
              </div>
              <NavLink
                to="/admin/roles-permisos"
                className={({ isActive }) =>
                  `nav__sublink ${isActive ? "active" : ""}`
                }
              >
                Roles & Permisos
              </NavLink>

             

              {/* ---- Gestionar unidades ---- */}
              <div className="nav__package">
                <button
                  type="button"
                  className="nav-group__header"
                  onClick={() => setUniOpen((v) => !v)}
                >
                  <span>Gestionar unidades</span>
                  <span className={`chev ${uniOpen ? "open" : ""}`}>▸</span>
                </button>
                <div className={`nav-group__items ${uniOpen ? "open" : ""}`}>
                  <NavLink
                    to="/admin/unidades"
                    className={({ isActive }) =>
                      `nav__sublink ${isActive ? "active" : ""}`
                    }
                  >
                    Unidades
                  </NavLink>
                </div>
              </div>

              {/* ---- Finanzas ---- */}
              <div className="nav__package">
                <button
                  type="button"
                  className="nav-group__header"
                  onClick={() => setFinOpen((v) => !v)}
                >
                  <span>Finanzas</span>
                  <span className={`chev ${finOpen ? "open" : ""}`}>▸</span>
                </button>
                <div className={`nav-group__items ${finOpen ? "open" : ""}`}>
                  <NavLink
                    to="/admin/cuotas"
                    className={({ isActive }) =>
                      `nav__sublink ${isActive ? "active" : ""}`
                    }
                  >
                    Cuotas
                  </NavLink>
                </div>
              </div>

              {/* ---- Comunicación ---- */}
              <div className="nav__package">
                <button
                  type="button"
                  className="nav-group__header"
                  onClick={() => setComOpen((v) => !v)}
                >
                  <span>Comunicación</span>
                  <span className={`chev ${comOpen ? "open" : ""}`}>▸</span>
                </button>
                <div className={`nav-group__items ${comOpen ? "open" : ""}`}>
                  <NavLink
                    to="/admin/avisos"
                    className={({ isActive }) =>
                      `nav__sublink ${isActive ? "active" : ""}`
                    }
                  >
                    Avisos (Admin)
                  </NavLink>
                </div>
              </div>

              {/* Áreas comunes */}
              <div className="nav__package">
                <button
                  type="button"
                  className="nav-group__header"
                  onClick={() => setAreasOpen((v) => !v)}
                >
                  <span>Áreas comunes</span>
                  <span className={`chev ${areasOpen ? "open" : ""}`}>▸</span>
                </button>
                <div className={`nav-group__items ${areasOpen ? "open" : ""}`}>
                  <NavLink
                    to="/admin/areas-comunes"
                    className={({ isActive }) =>
                      `nav__sublink ${isActive ? "active" : ""}`
                    }
                  >
                    Catálogo de áreas
                  </NavLink>
                  <NavLink
                    to="/admin/areas-comunes/reglas"
                    className={({ isActive }) =>
                      `nav__sublink ${isActive ? "active" : ""}`
                    }
                  >
                    Reglas de disponibilidad
                  </NavLink>
                </div>
              </div>

              {/* ---- Gestión de tareas ---- */}
              <div className="nav__package">
                <button
                  type="button"
                  className="nav-group__header"
                  onClick={() => setTasksOpen((v) => !v)}
                >
                  <span>Gestión de tareas</span>
                  <span className={`chev ${tasksOpen ? "open" : ""}`}>▸</span>
                </button>
                <div className={`nav-group__items ${tasksOpen ? "open" : ""}`}>
                  <NavLink
                    to="/admin/tareas"
                    className={({ isActive }) =>
                      `nav__sublink ${isActive ? "active" : ""}`
                    }
                  >
                    Tareas (Admin)
                  </NavLink>
                  <NavLink
                    to="/admin/asignar-tareas"
                    className={({ isActive }) =>
                      `nav__sublink ${isActive ? "active" : ""}`
                    }
                  >
                    Asignar tareas
                  </NavLink>
                </div>
              </div>

              {/* ---- Seguridad ---- */}
              <div className="nav__package">
                <button
                  type="button"
                  className="nav-group__header"
                  onClick={() => setSegOpen((v) => !v)}
                >
                  <span>Seguridad</span>
                  <span className={`chev ${segOpen ? "open" : ""}`}>▸</span>
                </button>
                <div className={`nav-group__items ${segOpen ? "open" : ""}`}>
                  <NavLink
                    to="/admin/infracciones"
                    className={({ isActive }) =>
                      `nav__sublink ${isActive ? "active" : ""}`
                    }
                  >
                    Infracciones
                  </NavLink>
                </div>
              </div>

              {/* ---- Reportes (placeholder) ---- */}
              <div className="nav__package">
                <button
                  type="button"
                  className="nav-group__header"
                  onClick={() => setRepOpen((v) => !v)}
                >
                  <span>Reportes</span>
                  <span className={`chev ${repOpen ? "open" : ""}`}>▸</span>
                </button>
                <div className={`nav-group__items ${repOpen ? "open" : ""}`}>
                  {/* vacío por ahora */}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer fijo */}
        <div className="userbox userbox--sticky">
          <div className="muted" style={{ fontSize: 18 }}>
            {me?.role || "—"}{" "}
            {roleCode ? <span className="badge">{roleCode}</span> : null}
          </div>
          <button className="au-button au-button--ghost" onClick={signout}>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ===== Contenido ===== */}
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
