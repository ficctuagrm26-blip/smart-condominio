export default function Dashboard() {
const me = JSON.parse(localStorage.getItem("me") || "null");
return (
<div>
<h1>Dashboard</h1>
<p>Bienvenido, {me?.username || "usuario"}.</p>
</div>
);
}