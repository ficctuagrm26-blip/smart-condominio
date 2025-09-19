export default function Me() {
const me = JSON.parse(localStorage.getItem("me") || "null");
return (
<div>
<h1>Mi Perfil</h1>
<pre>{JSON.stringify(me, null, 2)}</pre>
</div>
);
}