import { useRef, useState, useEffect } from "react";
import * as faceapi from "face-api.js";
import { faceIdentify } from "../api/face";
import api from "../api/auth";
import "./FaceIdentify.css";

export default function FaceIdentify() {
  const [cameraId, setCameraId] = useState("PT-01");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");
  const [modelReady, setModelReady] = useState(false);
  const [residentInfo, setResidentInfo] = useState(null);

  // ⬇️ NUEVO: estado real para renderizar botones
  const [camOn, setCamOn] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        setModelReady(true);
      } catch {
        setErr("No pude cargar /models. Copia los archivos del modelo a /public/models.");
      }
    })();
    return () => stopCam();
  }, []);

  async function startCam() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      const v = videoRef.current;
      v.srcObject = stream;
      await v.play();

      await new Promise((res) => (v.videoWidth ? res() : (v.onloadedmetadata = res)));

      const c = canvasRef.current;
      c.width = v.videoWidth;
      c.height = v.videoHeight;

      setCamOn(true);              // ⬅️ IMPORTANTE
      startLoop();
    } catch (e) {
      setErr(e?.message || "No se pudo abrir la cámara");
    }
  }

  function stopCam() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setCamOn(false);               // ⬅️ IMPORTANTE
  }

  function startLoop() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });

    const tick = async () => {
      if (!streamRef.current) return;
      let dets = [];
      try {
        dets = await faceapi.detectAllFaces(v, opts);
      } catch {}
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#10b981";
      dets.forEach(({ box }) => ctx.strokeRect(box.x, box.y, box.width, box.height));
      rafRef.current = requestAnimationFrame(tick);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }

  async function captureFromCam() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setErr("Enciende la cámara para capturar.");
      return;
    }
    const tmp = document.createElement("canvas");
    tmp.width = v.videoWidth;
    tmp.height = v.videoHeight;
    tmp.getContext("2d").drawImage(v, 0, 0, tmp.width, tmp.height);
    const blob = await new Promise((r) => tmp.toBlob(r, "image/jpeg", 0.9));
    const f = new File([blob], "face-snapshot.jpg", { type: "image/jpeg" });
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function onFile(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  async function fetchResidentInfoFromResult(result) {
    setResidentInfo(null);
    const raw = result?.best?.ExternalImageId || "";
    const id = String(raw).match(/\d+/)?.[0];
    if (!id) return;
    try {
      const { data } = await api.get(`admin/users/${id}/`);
      setResidentInfo({
        id: data.id,
        name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || data.username || `ID ${data.id}`,
        email: data.email || "",
        username: data.username || "",
        role: data?.profile?.role?.code || "",
      });
    } catch {
      /* sin permisos: no mostramos tarjeta y seguimos */
    }
  }

  async function identifyWithCurrentFile() {
    if (!file) {
      setErr("Captura con la cámara o sube una foto primero.");
      return;
    }
    setLoading(true);
    setErr("");
    setOut(null);
    try {
      const data = await faceIdentify({ camera_id: cameraId, file });
      setOut(data);
      await fetchResidentInfoFromResult(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Error identificando rostro");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    await identifyWithCurrentFile();
  }

  const canIdentify = !!file && !loading;

  return (
    <div className="fi-container">
      <h1 className="fi-title">Identificar rostro (dinámico)</h1>

      <form onSubmit={onSubmit} className="fi-form">
        <label className="fi-label">
          Cámara
          <input className="fi-input" value={cameraId} onChange={(e) => setCameraId(e.target.value)} />
        </label>

        <div className="fi-card">
          <div className="fi-video-wrap">
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} className="fi-overlay" />
            <div className={`fi-badge ${modelReady ? "ok" : "warn"}`}>
              {modelReady ? "tiny_face_detector cargado" : "cargando modelo…"}
            </div>
          </div>

          <div className="fi-actions">
            {!camOn ? (
              <button type="button" className="fi-btn" onClick={startCam} disabled={!modelReady}>
                Encender cámara
              </button>
            ) : (
              <>
                <button type="button" className="fi-btn fi-btn--danger" onClick={stopCam}>
                  Apagar
                </button>
                <button type="button" className="fi-btn" onClick={captureFromCam}>
                  Capturar foto
                </button>
                <button
                  type="button"
                  className="fi-btn fi-btn--primary"
                  onClick={async () => {
                    await captureFromCam();
                    setTimeout(() => identifyWithCurrentFile(), 0);
                  }}
                  disabled={loading}
                  title="Captura y envía en un solo paso"
                >
                  Capturar y enviar
                </button>
              </>
            )}
          </div>
        </div>

        <div className="fi-card">
          <label className="fi-label">Subir foto (opcional)</label>
          <input type="file" accept="image/*" onChange={onFile} />
          {preview && (
            <div className="fi-preview">
              <img src={preview} alt="preview" />
            </div>
          )}
        </div>

        <button className="fi-btn fi-btn--primary" disabled={!canIdentify}>
          {loading ? "Identificando…" : "Identificar"}
        </button>
        {!file && <div className="fi-hint">Tip: captura con la cámara o sube un archivo para habilitar “Identificar”.</div>}
      </form>

      {err && <div className="fi-alert fi-alert--error">{err}</div>}

      {out && (
        <div className="fi-result">
          <div className="fi-pair"><span>Decisión:</span><b>{out?.event?.decision || "-"}</b></div>
          <div className="fi-pair">
            <span>Similaridad:</span>
            <b>{out?.best?.Similarity ? `${out.best.Similarity.toFixed(2)}%` : out?.event?.score ? `${(out.event.score * 100).toFixed(2)}%` : "-"}</b>
          </div>
          {out?.best?.ExternalImageId && (
            <div className="fi-pair"><span>ExternalImageId:</span><b>{out.best.ExternalImageId}</b></div>
          )}

          {residentInfo && (
            <div className="fi-user">
              <div className="fi-user__title">Residente</div>
              <div className="fi-user__grid">
                <div><span>ID</span><b>{residentInfo.id}</b></div>
                <div><span>Nombre</span><b>{residentInfo.name}</b></div>
                <div><span>Usuario</span><b>{residentInfo.username || "—"}</b></div>
                <div><span>Email</span><b>{residentInfo.email || "—"}</b></div>
                <div><span>Rol</span><b>{residentInfo.role || "—"}</b></div>
              </div>
            </div>
          )}

          {out?.event?.snapshot && (
            <div className="fi-link">
              Snapshot:{" "}
              <a href={`${import.meta.env.VITE_API_BASE}${out.event.snapshot}`} target="_blank" rel="noreferrer">
                ver
              </a>
            </div>
          )}

          <details className="fi-details">
            <summary>Respuesta completa</summary>
            <pre className="fi-code">{JSON.stringify(out, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
