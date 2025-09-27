// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Signin from "./pages/Signin";
import Dashboard from "./pages/Dashboard";
import Me from "./pages/Me";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";

import AdminUsers from "./pages/AdminUsers";
import RolesPermisos from "./pages/RolesPermisos";
import UnitsPage from "./pages/UnitsPage";
import CuotasPage from "./pages/CuotasPage";
import InfraccionesPage from "./pages/InfraccionesPage";
import EstadoCuentaPage from "./pages/EstadoCuentaPage";
import AdminAvisosPage from "./pages/AdminAvisosPage";
import MisAvisosPage from "./pages/MisAvisosPage";

import AdminTareasPage from "./pages/AdminTareasPage";
import MisTareasPage from "./pages/MisTareasPage";
import RolesPage from "./pages/Roles";
import Permisos from "./pages/Permisos";
// NUEVO
import AsignarTareasPage from "./pages/AsignarTareasPage";
import VisitsPage from "./pages/VisitsPage";
import StaffPage from "./pages/StaffPage";
// Áreas comunes
import AreasDisponibilidad from "./pages/AreasDisponibilidad"; // CU16
import AreaReservaNueva from "./pages/AreaReservaNueva"; // CU17
import AdminAreasPage from "./pages/AdminAreasPage"; // gestión de áreas
import AdminAreaReglasPage from "./pages/AdminAreaReglasPage"; // CU19 (NUEVO)
import VehiculosPage from "./pages/VehiculosPage";
import SolicitudesVehiculoPage from "./pages/SolicitudesVehiculoPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pública */}
        <Route path="/signin" element={<Signin />} />

        {/* Zona autenticada */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="me" element={<Me />} />

          {/* Usuarios */}
          <Route
            path="admin/usuarios"
            element={
              <RequireRole allow={["ADMIN", "STAFF"]}>
                <AdminUsers />
              </RequireRole>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <RequireRole roles={["ADMIN"]}>
                <RolesPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin/permisos"
            element={
              <RequireRole roles={["ADMIN"]}>
                <Permisos />
              </RequireRole>
            }
          />
          <Route
            path="/personal"
            element={
              <RequireRole roles={["ADMIN"]}>
                <StaffPage />
              </RequireRole>
            }
          />

          {/* Unidades, cuotas, infracciones */}
          <Route
            path="admin/unidades"
            element={
              <RequireRole allow={["ADMIN"]}>
                <UnitsPage />
              </RequireRole>
            }
          />
          {/* Visitas: deja que entren ADMIN/STAFF/RESIDENT */}
          <Route
            path="visits"
            element={
              <RequireRole allow={["ADMIN", "STAFF", "RESIDENT"]}>
                <VisitsPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/cuotas"
            element={
              <RequireRole allow={["ADMIN"]}>
                <CuotasPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/infracciones"
            element={
              <RequireRole allow={["ADMIN"]}>
                <InfraccionesPage />
              </RequireRole>
            }
          />

          {/* Avisos */}
          <Route
            path="admin/avisos"
            element={
              <RequireRole allow={["ADMIN"]}>
                <AdminAvisosPage />
              </RequireRole>
            }
          />
          <Route path="avisos" element={<MisAvisosPage />} />

          {/* Tareas */}
          <Route
            path="admin/tareas"
            element={
              <RequireRole allow={["ADMIN", "STAFF"]}>
                <AdminTareasPage />
              </RequireRole>
            }
          />
          <Route path="tareas" element={<MisTareasPage />} />

          {/* NUEVO: Asignar tareas */}
          <Route
            path="admin/asignar-tareas"
            element={
              <RequireRole allow={["ADMIN", "STAFF"]}>
                <AsignarTareasPage />
              </RequireRole>
            }
          />

          {/* Estado de cuenta */}
          <Route path="/estado-cuenta" element={<EstadoCuentaPage />} />

          {/* Áreas Comunes (usuarios) */}
          <Route
            path="areas/disponibilidad"
            element={<AreasDisponibilidad />}
          />
          <Route path="areas/reservar" element={<AreaReservaNueva />} />

          {/* Áreas Comunes (admin) */}
          <Route
            path="admin/areas-comunes"
            element={
              <RequireRole allow={["ADMIN"]}>
                <AdminAreasPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/areas-comunes/reglas"
            element={
              <RequireRole allow={["ADMIN"]}>
                <AdminAreaReglasPage />
              </RequireRole>
            }
          />
          {/* Vehículos (usuarios, también puede ver admin/staff) */}
          <Route
            path="vehiculos"
            element={
              <RequireRole allow={["ADMIN", "STAFF", "RESIDENT"]}>
                <VehiculosPage />
              </RequireRole>
            }
          />

          {/* Solicitudes de Vehículo (revisión) – ADMIN/STAFF */}
          <Route
            path="admin/solicitudes-vehiculo"
            element={
              <RequireRole allow={["ADMIN", "STAFF"]}>
                <SolicitudesVehiculoPage />
              </RequireRole>
            }
          />

          {/* 404 dentro autenticado */}
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* 404 global */}
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
