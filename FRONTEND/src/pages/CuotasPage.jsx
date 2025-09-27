import { useEffect, useState } from "react";
import { listCuotas, generarCuotas, pagarCuota, anularCuota } from "../api/cuotas";
import GenerarCuotasModal from "./modals/GenerarCuotasModal";
import PagarCuotaModal from "./modals/PagarCuotaModal";
import "./CuotasPage.css";

const ORDER_ALLOWED = new Set(["vencimiento", "updated_at", "total_a_pagar", "pagado"]);
const isAnulada = (s) => ["ANULADA"].includes(String(s || "").toUpperCase());

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
    manzana: "",
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

      // Backend (CuotaViewSet) ahora filtra por unidad__manzana/lote/numero.
      const params = {
        search,
        ordering,
        periodo: f.periodo || undefined,
        concepto: f.concepto || undefined,
        estado: f.estado || undefined,   // PENDIENTE/PARCIAL/PAGADA/VENCIDA/ANULADA
        is_active: isActiveParam,
        "unidad__manzana": f.manzana || undefined,
        unidad: f.unidad || undefined,   // id de unidad (opcional)
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
  }, [ordering]); // al montar y al cambiar ordering

  function toggleOrder(field) {
    if (!ORDER_ALLOWED.has(field)) return;
    setOrdering((o) => (o === field ? `-${field}` : field));
  }

  return (
    <div className="page">
      <div className="card au-toolbar mb-12">
        <form className="au-toolbar__form" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <div className="au-field">
            <label className="au-label">Buscar</label>
            <input
              className="au-input"
              placeholder="manzana/lote/número/periodo/concepto"
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
            placeholder="Manzana"
            value={f.manzana}
            onChange={(e) => setF({ ...f, manzana: e.target.value })}
          />
          <input
            className="au-input"
            placeholder="ID Unidad (opcional)"
            value={f.unidad}
            onChange={(e) => setF({ ...f, unidad: e.target.value })}
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

          <button className="au-button" type="submit">
            Aplicar
          </button>
          <button
            className="au-button au-button--ghost"
            type="button"
            onClick={() => {
              setF({
                manzana: "",
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
          <button className="au-button" type="button" onClick={() => setShowGen(true)}>
            + Generar cuotas
          </button>
        </form>
      </div>

      <div className="card">
        <table className="au-table">
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Periodo</th>
              <th>Concepto</th>
              <th className="is-clickable" onClick={() => toggleOrder("vencimiento")}>Vencimiento</th>
              <th className="is-clickable" onClick={() => toggleOrder("total_a_pagar")}>Total</th>
              <th className="is-clickable" onClick={() => toggleOrder("pagado")}>Pagado</th>
              <th>Saldo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center">Cargando…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-muted">Sin resultados</td>
              </tr>
            ) : (
              rows.map((r) => {
                const saldoNum = Number(r.saldo ?? ((Number(r.total_a_pagar) || 0) - (Number(r.pagado) || 0)));
                const estado = String(r.estado || "");
                const estadoClass =
                  estado === "PAGADA" ? "badge badge--success" :
                  estado === "VENCIDA" ? "badge badge--danger" :
                  estado === "PARCIAL" ? "badge badge--warning" :
                  estado === "ANULADA" ? "badge badge--dark" : "badge";
                return (
                  <tr key={r.id}>
                    <td>{r.unidad_display || r.unidad || "-"}</td>
                    <td>{r.periodo}</td>
                    <td>{r.concepto}</td>
                    <td>{r.vencimiento}</td>
                    <td>{Number(r.total_a_pagar).toFixed(2)}</td>
                    <td>{Number(r.pagado).toFixed(2)}</td>
                    <td>{saldoNum.toFixed(2)}</td>
                    <td><span className={estadoClass}>{estado}</span></td>
                    <td className="actions">
                      <button
                        className="au-button"
                        disabled={isAnulada(r.estado)}
                        onClick={() => setCuotaToPay(r)}
                        title="Registrar pago"
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
                        title="Anular cuota"
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

        <div className="pager">
          <button className="au-button" disabled={!prev} onClick={() => load(prev)}>
            Anterior
          </button>
          <button className="au-button" disabled={!next} onClick={() => load(next)}>
            Siguiente
          </button>
          <div className="ml-auto text-muted">Total: {count}</div>
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
