import { Navigate } from "react-router-dom";

export default function RequireRole({ children, allow = [] }) {
  const token = localStorage.getItem("access");
  const meRaw = localStorage.getItem("me");
  if (!token || !meRaw) return <Navigate to="/signin" />;
  const me = JSON.parse(meRaw);
  if (allow.length === 0 || allow.includes(me.role)) return children;
  return <Navigate to="/dashboard" />;
}
