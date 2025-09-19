import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { me } from "../api/auth";


export default function RequireAuth({ children }) {
const [status, setStatus] = useState("checking"); // 'checking' | 'ok' | 'nope'
const location = useLocation();

//GET si no hay token retorna
useEffect(() => {
const token = localStorage.getItem("token");
if (!token) {
setStatus("nope");
return;
}

//si hay Token actualiza
const cached = localStorage.getItem("me");
if (cached) {
setStatus("ok");
// Actualiza en segundo plano
me().then((p) => localStorage.setItem("me", JSON.stringify(p))).catch(() => setStatus("nope"));
return;
}

//con token pero sin perfil hace me una vez
me()
.then((p) => {
localStorage.setItem("me", JSON.stringify(p));
setStatus("ok");
})
.catch(() => setStatus("nope"));
}, []);


if (status === "checking") return null; // o un spinner
//Mientras valida devolvera null hasta que acabe de validar

if (status === "nope") {
return <Navigate to="/signin" replace state={{ from: location }} />;
}
// si no hay sesion redirige al inicio de sesion 

return children;
//si todo ok, renderiza el contenido protegido
}