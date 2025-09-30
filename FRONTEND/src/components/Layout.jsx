// src/components/Layout.jsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import "../styles.css";
import { getRole } from "../api/auth";

/** ========== Helpers visuales reusables ========== */
function NavGroup({ title, open, onToggle, children, hidden }) {
  if (hidden) return null;
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

function SubGroup({ title, open, onToggle, children, hidden }) {
  if (hidden) return null;
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

function NavItem({ to, children, hidden }) {
  if (hidden) return null;
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
    try { return JSON.parse(localStorage.getItem("me") || "{}"); }
    catch { return {}; }
  }, []);

  // --- Normaliza el rol a uno de: "ADMIN" | "STAFF" | "RESIDENT"
  const roleFromStorage = getRole(me) || (me?.is_superuser ? "ADMIN" : "");
  const role = roleFromStorage === "RESIDENTE" ? "RESIDENT" : roleFromStorage;
  const isRes  = role === "RESIDENT";
  const isStaff = role === "STAFF";
  const isAdm  = role === "ADMIN";

  const roleCode =
    me?.profile?.role?.code ||
    me?.profile?.role_code ||
    (me?.is_superuser ? "ADMIN" : "");

  const can = (roles) => {
    if (!roles || roles.length === 0) return true;
    return roles.includes(role);
  };

  const signout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("me");
    navigate("/signin", { replace: true });
  };

  // ====== Estado móvil: sidebar ======
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => { setSidebarOpen(false); }, [location.pathname, location.search]);

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
    fin: isPath("/admin/cuotas") || isPath("/admin/pagos") || isPath("/mis-pagos"),
    com: isPath("/admin/avisos"),
    areas: isPath("/admin/areas-comunes"),
    tasks: isPath("/admin/tareas") || isPath("/admin/asignar-tareas"),
    seg: isPath("/admin/infracciones"),
    rep: isPath("/admin/reportes"),
    reservas: isPath("/admin/reservas") || isPath("/admin/areas-comunes/reservas"),
    seguridad: isPath("/acceso-vehicular") || isPath("/face"),
  }));

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) {
      setGroups((g) => ({ ...g, admin: true }));
    }
  }, [location.pathname]);

  const toggle = (key) => setGroups((g) => ({ ...g, [key]: !g[key] }));

  // ====== Cálculo de visibilidad por rol ======
  const show = {
    // menús simples
    dashboard: can(["ADMIN","STAFF","RESIDENT"]),
    areasDisp: can(["ADMIN","RESIDENT"]),
    misAvisos: can(["ADMIN","STAFF","RESIDENT"]),
    misTareas: can(["STAFF","ADMIN"]),
    misVehiculos: can(["ADMIN","STAFF","RESIDENT"]),
    bitacora: can(["ADMIN","STAFF"]),

    // gestionar usuarios
    me: can(["ADMIN","RESIDENT","STAFF"]),
    adminUsuarios: can(["ADMIN","STAFF"]), // si solo ADMIN, deja ["ADMIN"]
    adminRoles: can(["ADMIN"]),
    adminPerms: can(["ADMIN"]),
    estadoCuenta: can(["ADMIN","RESIDENT"]),
    personal: can(["ADMIN"]),
    vehiculosAut: can(["ADMIN","STAFF"]),

    // subgrupos
    sgUsuarios: can(["ADMIN","STAFF"]),
    sgComunicacion: can(["ADMIN"]),
    sgAreas: can(["ADMIN"]),
    sgTareas: can(["ADMIN","STAFF"]),
    sgReportes: can(["ADMIN"]),

    // ===== grupos principales =====
    // Antes: gFinanzas = can(["ADMIN"]) → ocultaba el grupo a RESIDENT
    gUnidades: can(["ADMIN","RESIDENT"]),
    gFinanzas: can(["ADMIN","RESIDENT"]),
    gSeguridad: can(["ADMIN","STAFF"]),
  };

  // si un grupo no tiene hijos visibles, lo escondemos
  const groupHasChildren = {
    admin:
      show.me ||
      show.adminUsuarios ||
      show.adminRoles ||
      show.adminPerms ||
      show.estadoCuenta ||
      show.personal ||
      show.vehiculosAut ||
      show.sgUsuarios ||
      show.sgComunicacion ||
      show.sgAreas ||
      show.sgTareas ||
      show.sgReportes,
    // Deriva de hijos visibles (mejor que un boolean “global”)
    gUnidades: show.gUnidades && (
      isAdm || isStaff || isRes
    ),
    gFinanzas: show.gFinanzas && (
      // hijos potenciales de finanzas
      isAdm || isRes
    ),
    gSeguridad: show.gSeguridad,
  };

  return (
    <div className={`layout ${sidebarOpen ? "layout--locked" : ""}`}>
      {/* ===== Topbar (móvil) ===== */}
      <header className="topbar">
        <button className="hamburger" aria-label="Abrir menú" onClick={() => setSidebarOpen((v) => !v)}>☰</button>
        <div className="topbar__title">Smart Condominio</div>
        <div className="topbar__spacer" />
      </header>

      {/* Backdrop móvil */}
      <div className={`sidebar__backdrop ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* ===== Sidebar ===== */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          Smart Condominio
        </div>

        {/* Contenido desplazable del menú */}
        <div className="sidebar__scroll">
          {show.dashboard && (
            <NavLink to="/dashboard" className={({ isActive }) => `nav__link ${isActive ? "active" : ""}`}>
              Dashboard
            </NavLink>
          )}

          {show.areasDisp && (
            <NavLink to="/areas/disponibilidad" className={({ isActive }) => `nav__link ${isActive ? "active" : ""}`}>
              Disponibilidad de áreas
            </NavLink>
          )}

          {show.misAvisos && (
            <NavLink to="/avisos" className={({ isActive }) => `nav__link ${isActive ? "active" : ""}`}>
              Avisos y Comunicados
            </NavLink>
          )}

          {show.misTareas && (
            <NavLink to="/tareas" className={({ isActive }) => `nav__link ${isActive ? "active" : ""}`}>
              Mis tareas
            </NavLink>
          )}

          {show.misVehiculos && (
            <NavLink to="/vehiculos" className={({ isActive }) => `nav__link ${isActive ? "active" : ""}`}>
              Mis vehículos
            </NavLink>
          )}
          {show.bitacora && (
            <NavLink to="/access/events/" className={({ isActive }) => `nav__link ${isActive ? "active" : ""}`}>
              Bitacora Vehiculos
            </NavLink>
          )}
           
          {/* ===== GESTIONAR USUARIOS ===== */}
          <NavGroup
            title="GESTIONAR USUARIOS"
            open={groups.admin}
            onToggle={() => toggle("admin")}
            hidden={!groupHasChildren.admin}
          >
            <NavItem to="/me" hidden={!show.me}>Gestionar Perfil (CU03)</NavItem>
            <NavItem to="/admin/usuarios" hidden={!show.adminUsuarios}>Gestionar Usuarios (CU04)</NavItem>
            <NavItem to="/admin/roles" hidden={!show.adminRoles}>Gestionar Roles (CU05)</NavItem>
            <NavItem to="/admin/permisos" hidden={!show.adminPerms}>Gestionar Permisos (CU06)</NavItem>
            <NavItem to="/estado-cuenta" hidden={!show.estadoCuenta}>Consultar Estado de Cuenta (CU10)</NavItem>
            <NavItem to="/personal" hidden={!show.personal}>Gestionar Personal (CU14)</NavItem>
            

            

            

            

            
          </NavGroup>

          {/* ===== GESTIONAR UNIDADES ===== */}
          <NavGroup
            title="GESTIONAR UNIDADES"
            open={groups.uni}                  // ← FIX: antes usaba groups.reservas
            onToggle={() => toggle("uni")}     // ← FIX
            hidden={!show.gUnidades}
          >
            <NavItem to="/admin/unidades" hidden={!isAdm}>Gestionar Unidades (CU07)</NavItem>
            <NavItem to="/visits" hidden={!isAdm && !isStaff}>Gestionar Visitas (CU22)</NavItem>
            <NavItem to="/mis-visitas" hidden={!isRes}>Mis Visitas (CU22)</NavItem>
            
          </NavGroup>

          {/* ===== GESTIONAR FINANZAS ===== */}
          <NavGroup
            title="GESTIONAR FINANZAS"
            open={groups.fin}
            onToggle={() => toggle("fin")}
            hidden={!groupHasChildren.gFinanzas}
          >
            <NavItem to="/admin/cuotas" hidden={!isAdm}>Gestionar Cuotas (CU08)</NavItem>
            <NavItem to="/admin/infracciones" hidden={!isAdm}>Gestionar Infracciones (CU09)</NavItem>
            <NavItem to="/mis-pagos" hidden={!isRes}>Mis Pagos (CU22)</NavItem>
            <NavItem to="/admin/pagos" hidden={!isAdm}>Gestionar Pagos (CU12)</NavItem>
            <NavItem to="pagos" hidden={!isRes}>Registrar Pagos(CU11)</NavItem>
          </NavGroup>
          {/* ===== GESTIONAR COMUNICACION ===== */}
          <NavGroup
            title="GESTIONAR COMUNICACIÓN"
            open={groups.fin}
            onToggle={() => toggle("fin")}
            hidden={!groupHasChildren.gFinanzas}
          >
            <NavItem to="admin/avisos" hidden={!isAdm}>Publicar Avisos (CU13)</NavItem>
            <NavItem to="avisos" >Avisos y Comunicados (CU13)</NavItem>
            <NavItem to="/mis-pagos" hidden={!isRes}>Mis Pagos (CU22)</NavItem>
            <NavItem to="/admin/pagos" hidden={!isAdm}>Gestionar Pagos (CU12)</NavItem>
            <NavItem to="pagos" hidden={!isRes}>Registrar Pagos(CU11)</NavItem>
          </NavGroup>

          {/* ===== GESTIONAR SEGURIDAD ===== */}
          <NavGroup
            title="GESTIONAR SEGURIDAD"
            open={groups.seguridad}
            onToggle={() => toggle("seguridad")}
            hidden={!show.gSeguridad}
          >
            <NavItem to="/acceso-vehicular">Acceso Vehicular (CU20)</NavItem>
            <NavItem to="/admin/solicitudes-vehiculo" hidden={!show.vehiculosAut}>
              Gestionar Vehículos Autorizados (CU26)
            </NavItem>
            <NavItem to="/visits">Gestionar Visitas (CU22)</NavItem>
            <NavItem to="/face/enroll">Cargar Rostros (CU23)</NavItem>
            <NavItem to="/face/identify">Reconocimiento facial (CU23)</NavItem>
            <NavItem to="/access/face-log" hidden={!isAdm}>Bitacora de Ingresos (CU28)</NavItem>
          </NavGroup>
          {/* ===== GESTIONAR TAREAS ===== */}
          <NavGroup
            title="GESTIONAR TAREAS"
            open={groups.seguridad}
            onToggle={() => toggle("seguridad")}
            hidden={!show.gSeguridad}
          >
            <NavItem to="/admin/tareas" hidden={!isAdm}>Gestionar Tareas (CU15) </NavItem>
            <NavItem to="/admin/asignar-tareas" hidden={!show.vehiculosAut}>
              Asignar Tareas (CU24)
            </NavItem>
            
          </NavGroup>
          {/* ===== GESTIONAR AREAS COMUNES ===== */}
          <NavGroup
            title="GESTIONAR AREAS COMUNES"
            open={groups.seguridad}
            onToggle={() => toggle("seguridad")}
            hidden={!show.gSeguridad}
          >
            <NavItem to="/areas/disponibilidad" hidden={!isAdm}>Consultar Disponibilidad (CU16) </NavItem>
            <NavItem to="/admin/areas-comunes" hidden={!show.vehiculosAut}>
              Gestionar Areas (CU17)
            </NavItem>
             <NavItem to="/admin/areas-comunes/reglas" hidden={!show.vehiculosAut}>
              Gestionar Disponibilidad (CU19)
            </NavItem>
            
          </NavGroup>

          {/* ===== GESTIONAR REPORTES ===== */}
          <NavGroup
            title="GESTIONAR REPORTES"
            open={groups.seguridad}
            onToggle={() => toggle("seguridad")}
            hidden={!show.gSeguridad}
          >
            <NavItem to="/areas/disponibilidad" hidden={!isAdm}>Reportes de Seguridad (CU30) </NavItem>
            
            
          </NavGroup>
        </div>
        

        {/* Footer fijo */}
        <div className="userbox userbox--sticky">
          <div className="muted" style={{ fontSize: 18 }}>
            {role || "—"} {roleCode ? <span className="badge">{roleCode}</span> : null}
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
