// src/components/Layout.jsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import "../styles.css";

/** ========== Helpers visuales reusables ========== */
function NavGroup({ title, open, onToggle, children }) {
  return (
    <div className="nav-group">
      <button type="button" className="nav-group__header" onClick={onToggle}>
        <span>{title}</span>
        <span className={`chev ${open ? "open" : ""}`}>▸</span>
      </button>
      <div className={`nav-group__items ${open ? "open" : ""}`}>{children}</div>
    </div>
  );
}

function SubGroup({ title, open, onToggle, children }) {
  return (
    <div className="nav__package">
      <button type="button" className="nav-group__header" onClick={onToggle}>
        <span>{title}</span>
        <span className={`chev ${open ? "open" : ""}`}>▸</span>
      </button>
      <div className={`nav-group__items ${open ? "open" : ""}`}>{children}</div>
    </div>
  );
}

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav__sublink ${isActive ? "active" : ""}`}
    >
      {children}
    </NavLink>
  );
}

/** ============================ Layout ============================ */
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

  // ====== Helpers y params ======
  const params = new URLSearchParams(location.search);
  const currentGroup = params.get("group");
  const onUsersPath = location.pathname === "/admin/usuarios";
  const activeUsers = onUsersPath && !currentGroup;
  const activeStaff = onUsersPath && currentGroup === "staff";
  const activeResidents = onUsersPath && currentGroup === "residents";
  const isPath = (p) => location.pathname.startsWith(p);

  // ========= Estado de grupos =========
  const [groups, setGroups] = useState(() => ({
    admin: location.pathname.startsWith("/admin"),
    usr: isPath("/admin/usuarios"),
    uni: isPath("/admin/unidades"),
    fin: isPath("/admin/cuotas") || isPath("/admin/pagos"),
    com: isPath("/admin/avisos"),
    areas: isPath("/admin/areas-comunes"),
    tasks: isPath("/admin/tareas") || isPath("/admin/asignar-tareas"),
    seg: isPath("/admin/infracciones"),
    rep: isPath("/admin/reportes"),
    reservas: isPath("/admin/reservas") || isPath("/admin/areas-comunes/reservas"),
  }));

  // abrir automáticamente "admin" si entras a /admin
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) {
      setGroups((g) => ({ ...g, admin: true }));
    }
  }, [location.pathname]);

  const toggle = (key) => setGroups((g) => ({ ...g, [key]: !g[key] }));

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

      {/* Backdrop móvil */}
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
          <NavLink
            to="/vehiculos"
            className={({ isActive }) =>
              `nav__link ${isActive ? "active" : ""}`
            }
            
          >
            Mis vehículos
          </NavLink>
          {/* ===== GESTIONAR USUARIOS ===== */}
          <NavGroup
            title="GESTIONAR USUARIOS"
            open={groups.admin}
            onToggle={() => toggle("admin")}
          >
            <NavItem to="/me">Gestionar Perfil (CU03)</NavItem>
            <NavItem to="/admin/usuarios">Gestionar Usuarios (CU04)</NavItem>
            <NavItem to="/admin/roles">Gestionar Roles (CU05)</NavItem>
            <NavItem to="/admin/permisos">Gestionar Permisos (CU06)</NavItem>
            <NavItem to="/estado-cuenta">Consultar Estado de Cuenta (CU10)</NavItem>
            <NavItem to="/personal">Gestionar Personal (CU14)</NavItem>
            <NavItem to="/admin/solicitudes-vehiculo">
              Gestionar Vehículos Autorizados (CU26)
            </NavItem>

            {/* Subgrupo: Gestión de usuarios (CU04) */}
            <SubGroup
              title="Gestionar Usuarios (CU04)"
              open={groups.usr}
              onToggle={() => toggle("usr")}
            >
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
                to={{ pathname: "/admin/usuarios", search: "?group=residents" }}
                className={`nav__sublink ${activeResidents ? "active" : ""}`}
              >
                Residentes
              </Link>
            </SubGroup>

            {/* Subgrupo: Comunicación */}
            <SubGroup
              title="Comunicación"
              open={groups.com}
              onToggle={() => toggle("com")}
            >
              <NavItem to="/admin/avisos">Avisos (Admin)</NavItem>
            </SubGroup>

            {/* Subgrupo: Áreas comunes */}
            <SubGroup
              title="Áreas comunes"
              open={groups.areas}
              onToggle={() => toggle("areas")}
            >
              <NavItem to="/admin/areas-comunes">Catálogo de áreas</NavItem>
              <NavItem to="/admin/areas-comunes/reglas">
                Reglas de disponibilidad
              </NavItem>
            </SubGroup>

            {/* Subgrupo: Gestión de tareas */}
            <SubGroup
              title="Gestión de tareas"
              open={groups.tasks}
              onToggle={() => toggle("tasks")}
            >
              <NavItem to="/admin/tareas">Tareas (Admin)</NavItem>
              <NavItem to="/admin/asignar-tareas">Asignar tareas</NavItem>
            </SubGroup>

            {/* Subgrupo: Reportes */}
            <SubGroup
              title="Reportes"
              open={groups.rep}
              onToggle={() => toggle("rep")}
            >
              {/* vacío por ahora */}
            </SubGroup>
          </NavGroup>

          {/* ===== Otros menús principales ===== */}
          <NavGroup
            title="GESTIONAR UNIDADES"
            open={groups.reservas}
            onToggle={() => toggle("reservas")}
          >
            <NavItem to="/admin/unidades">Gestionar Unidades (CU07)</NavItem>
            <NavItem to="/visits/">Gestionar Visitas (CU22)</NavItem>
          </NavGroup>

          <NavGroup
            title="GESTIONAR FINANZAS"
            open={groups.fin}
            onToggle={() => toggle("fin")}
          >
            <NavItem to="/admin/cuotas">Gestionar Cuotas (CU08)</NavItem>
            <NavItem to="/admin/infracciones">Gestionar Infracciones (CU09)</NavItem>
          </NavGroup>
          <NavGroup
            title="GESTIONAR SEGURIDAD"
            open={groups.reservas}
            onToggle={() => toggle("reservas")}
          >
            <NavItem to="/acceso-vehicular">Acceso Vehicular (CU23)</NavItem>
            <NavItem to="/visits/">Gestionar Visitas (CU22)</NavItem>
            <NavItem to="/face/enroll">Enrolar Rostros (CU23)</NavItem>
            <NavItem to="/face/identify">Reconocimiento facial (CU23)</NavItem>
          </NavGroup>
        </div>
        

        {/* Footer fijo */}
        <div className="userbox userbox--sticky">
          <div className="muted" style={{ fontSize: 18 }}>
            {me?.role || "—"} {roleCode ? <span className="badge">{roleCode}</span> : null}
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
