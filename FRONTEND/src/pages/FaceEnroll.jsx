import { useEffect, useRef, useState, useMemo } from "react";
import api from "../api/auth";
import { faceRegister } from "../api/face";
import "./FaceEnroll.css";

function useDebouncedValue(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function FaceEnroll() {
  // --- estado general
  const [residentId, setResidentId] = useState("");
  const [residentSearch, setResidentSearch] = useState("");
  const debouncedSearch = useDebouncedValue(residentSearch, 350);

  const [residents, setResidents] = useState([]);
  const [loadingResidents, setLoadingResidents] = useState(true);
  const [residentError, setResidentError] = useState("");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");

  // --- cámara
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [camOn, setCamOn] = useState(false);
  const [capturing, setCapturing] = useState(false);

  // recuadro guía (proporción del video para recortar)
  const boxRatio = 0.6; // lado = 60% del menor lado del video

  // ---- cargar residentes (ADMIN) con búsqueda remota (?search=)
  async function fetchResidents(search = "") {
    setResidentError("");
    setLoadingResidents(true);
    try {
      const params = { page_size: 100 };
      if (search.trim()) params.search = search.trim();
      // acción "residents" del AdminUserViewSet
      const { data } = await api.get("admin/users/residents/", { params });
      const list = Array.isArray(data) ? data : data.results || data || [];
      setResidents(list);
    } catch (e) {
      // si 403, mostramos input manual
      setResidents([]);
      setResidentError(
        e?.response?.status === 403
          ? "No tienes permisos para listar residentes. Escribe el ID manualmente."
          : (e?.response?.data?.detail || e?.message || "Error cargando residentes")
      );
    } finally {
      setLoadingResidents(false);
    }
  }

  // carga inicial
  useEffect(() => { fetchResidents(""); }, []);
  // re-carga al escribir (debounce)
  useEffect(() => { fetchResidents(debouncedSearch); }, [debouncedSearch]);

  const filteredResidents = useMemo(() => residents, [residents]); // ya vienen filtrados del server

  // --- manejar archivo
  function onFile(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  // --- cámara on/off
  async function startCam() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }, // cambia a "environment" si prefieres la trasera
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        streamRef.current = stream;
        setCamOn(true);
      }
    } catch (e) {
      setErr(e?.message || "No se pudo abrir la cámara");
    }
  }

  function stopCam() {
    const s = streamRef.current;
    s?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
  }

  // --- capturar cámara y recortar
  async function captureFromCam() {
    setErr("");
    setOut(null);
    if (!videoRef.current) return;

    try {
      setCapturing(true);
      const v = videoRef.current;
      const w = v.videoWidth || 1280;
      const h = v.videoHeight || 720;

      const side = Math.round(Math.min(w, h) * boxRatio);
      const sx = Math.round((w - side) / 2);
      const sy = Math.round((h - side) / 2);

      const canvas = document.createElement("canvas");
      canvas.width = side;
      canvas.height = side;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(v, sx, sy, side, side, 0, 0, side, side);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
      if (!blob) throw new Error("No se pudo capturar imagen");
      const f = new File([blob], "face-capture.jpg", { type: "image/jpeg" });

      setFile(f);
      setPreview(URL.createObjectURL(f));
    } catch (e) {
      setErr(e?.message || "Error capturando imagen");
    } finally {
      setCapturing(false);
    }
  }

  // --- submit
  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setOut(null);

    if (!file) {
      setErr("Sube una foto o captura desde la cámara.");
      return;
    }
    if (!residentId) {
      setErr("Selecciona un residente o escribe su ID.");
      return;
    }

    setLoading(true);
    try {
      const data = await faceRegister({ kind: "resident", obj_id: residentId, file });
      setOut(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Error registrando el rostro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fe-container">
      <h1 className="fe-title">Enrolar rostro (AWS Rekognition)</h1>

      <form onSubmit={onSubmit} className="fe-form">
        {/* Selección de residente */}
        <div className="fe-card">
          <div className="fe-card__header">Residente</div>

          <div className="fe-grid-2">
            <div>
              <label className="fe-label">Buscar residente</label>
              <input
                className="fe-input"
                placeholder="ID, nombre, email, usuario…"
                value={residentSearch}
                onChange={(e) => setResidentSearch(e.target.value)}
              />
              {loadingResidents && <div className="fe-hint">Buscando…</div>}
              {residentError && <div className="fe-alert fe-alert--error">{residentError}</div>}
            </div>

            <div>
              <label className="fe-label">Selecciona residente</label>
              <select
                className="fe-input"
                value={residentId}
                onChange={(e) => setResidentId(e.target.value)}
                disabled={loadingResidents || !!residentError}
              >
                <option value="">— Selecciona —</option>
                {filteredResidents.map((r) => {
                  const name = `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.username || r.email || `ID ${r.id}`;
                  return (
                    <option key={r.id} value={r.id}>
                      {name} (ID {r.id})
                    </option>
                  );
                })}
              </select>

              <div className="fe-hint" style={{ marginTop: 8 }}>
                ¿No aparece o no tienes permisos para listar? Escribe el <b>ID</b> manualmente:
              </div>
              <input
                className="fe-input"
                placeholder="Escribir ID manualmente (opcional)"
                value={residentId}
                onChange={(e) => setResidentId(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Cámara */}
        <div className="fe-card">
          <div className="fe-card__header">Cámara</div>

          <div className="fe-camera">
            <div className="fe-video-wrap">
              <video ref={videoRef} playsInline muted />
              <div className="fe-face-box" />
            </div>

            <div className="fe-actions">
              {!camOn ? (
                <button type="button" className="fe-btn" onClick={startCam}>
                  Encender cámara
                </button>
              ) : (
                <>
                  <button type="button" className="fe-btn fe-btn--danger" onClick={stopCam}>
                    Apagar
                  </button>
                  <button
                    type="button"
                    className="fe-btn"
                    disabled={capturing}
                    onClick={captureFromCam}
                  >
                    {capturing ? "Capturando…" : "Capturar y recortar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Subir archivo */}
        <div className="fe-card">
          <div className="fe-card__header">Subir archivo</div>
          <label className="fe-label">Foto (frontal, buena luz)</label>
          <input type="file" accept="image/*" onChange={onFile} />
          {preview && (
            <div className="fe-preview">
              <img src={preview} alt="preview" />
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="fe-actions fe-actions--end">
          <button className="fe-btn fe-btn--primary" disabled={loading}>
            {loading ? "Enviando…" : "Enrolar"}
          </button>
        </div>
      </form>

      {/* Mensajes */}
      {err && <div className="fe-alert fe-alert--error">Error: {String(err)}</div>}

      {out && (
        <pre className="fe-code">{JSON.stringify(out, null, 2)}</pre>
      )}
    </div>
  );
}
