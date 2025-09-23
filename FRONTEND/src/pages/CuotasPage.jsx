import { useEffect, useState } from "react";
import { listCuotas, generarCuotas, pagarCuota, anularCuota } from "../api/cuotas";
import GenerarCuotasModal from "./modals/GenerarCuotasModal";
import PagarCuotaModal from "./modals/PagarCuotaModal";

const ORDER_ALLOWED = new Set(["vencimiento", "updated_at", "total_a_pagar", "pagado"]);
const isAnulada = (s) => ["ANULADA", "ANULADO"].includes(String(s || "").toUpperCase());

export default function CuotasPage() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [prev, setPrev] = useState(null);
  const [loading, setLoading] = useState(false);

  // filtros/estado
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("-vencimiento"); // permitido por el backend
  const [f, setF] = useState({
    torre: "",
    unidad: "",
    periodo: "",
    concepto: "",
    estado: "",
    is_active: "", // "" = Activas + Inactivas
  });

  const [showGen, setShowGen] = useState(false);
  const [cuotaToPay, setCuotaToPay] = useState(null);

  async function load(pageUrl) {
    setLoading(true);
    try {
      const isActiveParam = f.is_active === "" ? undefined : f.is_active === "true";

      const params = {
        search,
        ordering,
        periodo: f.periodo,
        concepto: f.concepto,
        estado: f.estado,        // ahora manda PAGADA/VENCIDA/ANULADA...
        is_active: isActiveParam,
        torre: f.torre,
        unidad: f.unidad,
        page_size: 20,
      };

      const data = await listCuotas(params, pageUrl);
      const results = data.results || data;
      setRows(results);
      setCount(data.count ?? results.length);
      setNext(data.next ?? null);
      setPrev(data.previous ?? null);
    } catch (e) {
      console.error("Error listCuotas:", e);
      alert(e?.detail || "Error al listar cuotas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ordering]); // al entrar y al cambiar ordering

  function toggleOrder(field) {
    if (!ORDER_ALLOWED.has(field)) return; // ignorar orden no permitido
    setOrdering((o) => (o === field ? `-${field}` : field));
  }

  return (
    <div className="page">
      <div className="card au-toolbar" style={{ marginBottom: 12 }}>
        <div className="au-toolbar__form" onSubmit={(e) => e.preventDefault()}>
          <div className="au-field">
            <label className="au-label">Buscar</label>
            <input
              className="au-input"
              placeholder="torre/bloque/número/periodo/concepto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <input
            className="au-input"
            placeholder="Periodo (YYYY-MM)"
            value={f.periodo}
            onChange={(e) => setF({ ...f, periodo: e.target.value })}
          />
          <input
            className="au-input"
            placeholder="Concepto"
            value={f.concepto}
            onChange={(e) => setF({ ...f, concepto: e.target.value })}
          />
          <input
            className="au-input"
            placeholder="Torre"
            value={f.torre}
            onChange={(e) => setF({ ...f, torre: e.target.value })}
          />

          {/* ESTADO: usa las claves que tu backend acepta */}
          <select
            className="au-input"
            value={f.estado}
            onChange={(e) => setF({ ...f, estado: e.target.value })}
          >
            <option value="">Estado</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PARCIAL">Parcial</option>
            <option value="PAGADA">Pagada</option>
            <option value="VENCIDA">Vencida</option>
            <option value="ANULADA">Anulada</option>
          </select>

          <select
            className="au-input"
            value={f.is_active}
            onChange={(e) => setF({ ...f, is_active: e.target.value })}
          >
            <option value="">Activas + Inactivas</option>
            <option value="true">Solo activas</option>
            <option value="false">Solo inactivas</option>
          </select>

          <button className="au-button" onClick={() => load()}>
            Aplicar
          </button>
          <button
            className="au-button au-button--ghost"
            onClick={() => {
              setF({
                torre: "",
                unidad: "",
                periodo: "",
                concepto: "",
                estado: "",
                is_active: "",
              });
              setSearch("");
              load();
            }}
          >
            Limpiar
          </button>

          <div className="au-toolbar__spacer" />
          <button className="au-button" onClick={() => setShowGen(true)}>
            + Generar cuotas
          </button>
        </div>
      </div>

      <div className="card">
        <table className="au-table">
          <thead>
            <tr>
              <th>Unidad</th>
              {/* 'periodo' NO es ordenable en el backend → sin onClick */}
              <th>Periodo</th>
              <th>Concepto</th>
              <th onClick={() => toggleOrder("vencimiento")}>Vencimiento</th>
              <th onClick={() => toggleOrder("total_a_pagar")}>Total</th>
              <th onClick={() => toggleOrder("pagado")}>Pagado</th>
              <th>Saldo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9}>Cargando…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9}>Sin resultados</td>
              </tr>
            ) : (
              rows.map((r) => {
                const saldo =
                  (Number(r.total_a_pagar) || 0) - (Number(r.pagado) || 0);
                return (
                  <tr key={r.id}>
                    <td>
                      {r.unidad?.torre}-{r.unidad?.bloque}-{r.unidad?.numero}
                    </td>
                    <td>{r.periodo}</td>
                    <td>{r.concepto}</td>
                    <td>{r.vencimiento}</td>
                    <td>{Number(r.total_a_pagar).toFixed(2)}</td>
                    <td>{Number(r.pagado).toFixed(2)}</td>
                    <td>{Number(saldo).toFixed(2)}</td>
                    <td>{r.estado}</td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button
                        className="au-button"
                        disabled={isAnulada(r.estado)}
                        onClick={() => setCuotaToPay(r)}
                      >
                        Pagar
                      </button>
                      <button
                        className="au-button au-button--ghost"
                        disabled={Number(r.pagado) > 0 || isAnulada(r.estado)}
                        onClick={async () => {
                          if (!confirm("¿Anular esta cuota?")) return;
                          try {
                            await anularCuota(r.id);
                            await load();
                            alert("Cuota anulada correctamente");
                          } catch (e) {
                            console.error("Error al anular:", e);
                            alert(e?.detail || "No se pudo anular la cuota");
                          }
                        }}
                      >
                        Anular
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="pager" style={{ display: "flex", gap: 8, padding: 12 }}>
          <button className="au-button" disabled={!prev} onClick={() => load(prev)}>
            Anterior
          </button>
          <button className="au-button" disabled={!next} onClick={() => load(next)}>
            Siguiente
          </button>
          <div style={{ marginLeft: "auto" }}>Total: {count}</div>
        </div>
      </div>

      {showGen && (
        <GenerarCuotasModal
          onClose={() => setShowGen(false)}
          onOk={async (form) => {
            try {
              await generarCuotas({
                ...form,
                monto_base: parseFloat(form.monto_base || 0),
              });
              setShowGen(false);
              load();
            } catch (e) {
              console.error("GENERAR ERROR:", e);
              alert(e?.detail || "Error al generar cuotas");
            }
          }}
        />
      )}

      {cuotaToPay && (
        <PagarCuotaModal
          cuota={cuotaToPay}
          onClose={() => setCuotaToPay(null)}
          onOk={async (payload) => {
            try {
              await pagarCuota(cuotaToPay.id, {
                ...payload,
                monto: parseFloat(payload.monto || 0),
              });
              setCuotaToPay(null);
              load();
            } catch (e) {
              console.error("PAGAR ERROR:", e);
              alert(e?.detail || "Error al registrar el pago");
            }
          }}
        />
      )}
    </div>
  );
}
