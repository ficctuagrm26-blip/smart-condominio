// src/components/Layout.jsx
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "260px 1fr",
      minHeight: "100vh",
      background: "#0b0d12",
      color: "#e5e7eb"
    }}>
      <Sidebar />
      <main style={{ padding: 24 }}>
        <Outlet /> {/* aquí se renderizan dashboard, tickets, etc. */}
      </main>
    </div>
  );
}


