import { useEffect, useState } from "react";
import {
  getMisCuotas,
  crearIntentoPago,
  subirComprobante
} from "../api/payments";

export default function MisCuotasPage() {
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getMisCuotas();
      setCuotas(data.results || data);
    } catch (err) {
      console.error(err);
      alert("Error cargando cuotas");
    }
    setLoading(false);
  }

  async function handlePagar(cuota) {
    try {
      const intent = await crearIntentoPago(cuota.id, "QR");
      alert(`Intento creado. Escanea el QR o usa el link: ${intent.confirmation_url}`);
      load();
    } catch (err) {
      console.error(err);
      alert("Error creando intento");
    }
  }

  async function handleComprobante(cuota) {
    const intentId = cuota.ultimo_intento?.id;
    if (!intentId) return alert("No hay intento para esta cuota.");

    const receipt_url = prompt("Pega la URL del comprobante (ej: imgur, cloudinary):");
    if (!receipt_url) return;

    try {
      await subirComprobante({
        intent: intentId,
        receipt_url,
        amount: cuota.saldo,
        reference: `TRX-${Date.now()}`,
        bank_name: "Banco de Prueba"
      });
      alert("Comprobante enviado con éxito.");
      load();
    } catch (err) {
      console.error(err);
      alert("Error subiendo comprobante");
    }
  }

  return (
    <div>
      <h1>Mis Cuotas</h1>
      {loading && <p>Cargando...</p>}
      {cuotas.map(c => (
        <div key={c.id} style={{ border: "1px solid #ccc", margin: 8, padding: 8 }}>
          <p><b>{c.periodo}</b> - {c.concepto}</p>
          <p>Total: {c.total_a_pagar} | Pagado: {c.pagado} | Saldo: {c.saldo}</p>
          <p>Estado: {c.estado}</p>

          <button onClick={() => handlePagar(c)}>Pagar</button>
          <button onClick={() => handleComprobante(c)}>Subir Comprobante</button>
        </div>
      ))}
    </div>
  );
}
