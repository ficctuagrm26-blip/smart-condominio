import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const me = JSON.parse(localStorage.getItem("me") || "{}");
  const role = me.role || "RESIDENT";

  const sections = [
    {
      title: "Gestión de Roles y Permisos",
      show: role === "ADMIN",
      items: [{ to: "/users", label: "Usuarios y Roles", icon: "👥" }],
    },
    {
      title: "Gestión de Personal",
      show: role !== "RESIDENT",
      items: [{ to: "/staff", label: "Listado de Personal", icon: "🧑‍🔧" }],
    },
    {
      title: "Gestión de Mascotas",
      show: true,
      items: [{ to: "/pets", label: "Mascotas", icon: "🐾" }],
    },
    {
      title: "Gestión de Tareas y Calificación",
      show: true,
      items: [{ to: "/tickets", label: "Tickets / Tareas", icon: "📝" }],
    },
    {
      title: "Gestión de Compra y Venta",
      show: role === "ADMIN",
      items: [{ to: "/invoices", label: "Cuotas / Pagos", icon: "💳" }],
    },
    {
      title: "Reportes",
      show: true,
      items: [{ to: "/reports", label: "Reportes", icon: "📊" }],
    },
  ].filter(s => s.show);

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("me");
    navigate("/signin");
  };

  return (
    <aside className={styles.root}>
      <div className={styles.brand}>
        <span style={{fontSize:18}}>🏢</span> <span>SmartCondo</span>
      </div>

      <div className={styles.search}>
        <input placeholder="search" />
      </div>

      <nav className={styles.nav}>
        <div className={styles.group}>
          <Link
            to="/dashboard"
            className={`${styles.link} ${pathname === "/dashboard" ? styles.active : ""}`}
          >
            📋 Dashboard
          </Link>
        </div>

        {sections.map((sec, i) => (
          <div className={styles.group} key={i}>
            <div className={styles.groupTitle}>{sec.title}</div>
            {sec.items.map(it => (
              <Link
                key={it.to}
                to={it.to}
                className={`${styles.link} ${pathname === it.to ? styles.active : ""}`}
              >
                <span>{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.user}>{me.username} · {role}</div>
        <button className={styles.logout} onClick={logout}>Cerrar sesión</button>
      </div>
    </aside>
  );
}
