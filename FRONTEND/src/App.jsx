// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Signin from "./pages/Signin";
import Dashboard from "./pages/Dashboard";
import Me from "./pages/Me";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import Layout from "./components/Layout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* pública */}
        <Route path="/signin" element={<Signin />} />

        {/* protegida: todo lo que esté dentro tendrá el sidebar */}
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          {/* index del layout -> redirige al dashboard */}
          <Route index element={<Navigate to="/dashboard" />} />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/me" element={<Me />} />

          <Route
            path="/users"
            element={
              <RequireRole allow={["ADMIN"]}>
                <div className="container"><h1>Gestión de Usuarios (ADMIN)</h1></div>
              </RequireRole>
            }
          />

          <Route
            path="/tickets"
            element={
              <RequireRole allow={["ADMIN","STAFF","RESIDENT"]}>
                <div className="container"><h1>Tickets</h1></div>
              </RequireRole>
            }
          />

          {/* más páginas del menú */}
          {/* <Route path="/invoices" element={<Invoices />} /> */}
          {/* <Route path="/reports" element={<Reports />} /> */}
        </Route>

        {/* comodín */}
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
