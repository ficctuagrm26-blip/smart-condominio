# views_face.py
import re
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication

from .rekognition_client import index_face, search_by_image
from .models import AccessEvent  # reutilizas tu modelo existente
from .serializers import AccessEventSerializer

User = get_user_model()

def build_person_id(kind: str, obj_id: int | str) -> str:
    k = (kind or "").lower()
    if k not in ("resident", "visitor", "staff"):
        raise ValueError("kind inválido")
    return f"{k}:{obj_id}"


class FaceRegisterAWSView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        kind = request.data.get("kind")
        obj_id = request.data.get("obj_id")
        img = request.data.get("image")
        if not kind or not obj_id or not img:
            return Response({"detail": "kind, obj_id, image son requeridos"}, status=400)

        person_id = build_person_id(kind, obj_id)
        data = index_face(img.read(), external_id=person_id)
        return Response({"ok": True, "person_id": person_id, **data})


class FaceIdentifyAndLogAWSView(APIView):
    """
    POST multipart:
      - image: archivo
      - camera_id: opcional (ej. PT-01)
      - direction: opcional ("ENTRADA"|"SALIDA") — si no viene, se mapea con settings.CAMERA_DIRECTIONS[camera_id]
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    @transaction.atomic
    def post(self, request):
        img = request.data.get("image")
        camera_id = (request.data.get("camera_id") or "").strip()
        # Permite forzar ENTRADA/SALIDA desde el FE; si no llega, toma del mapping
        direction = (request.data.get("direction") or "").strip().upper()
        if not direction:
            direction = (getattr(settings, "CAMERA_DIRECTIONS", {}) or {}).get(camera_id, "")  # "ENTRADA"/"SALIDA"/""

        if not img:
            return Response({"ok": False, "detail": "image es requerido"}, status=400)

        img_bytes = img.read()

        # --- 1) Buscar coincidencias en Rekognition
        try:
            result = search_by_image(img_bytes, max_faces=5)
        except Exception as e:
            # registra evento de error (tipo facial, no OCR de placas, pero aprovechamos el mismo modelo)
            evt = AccessEvent.objects.create(
                camera_id=camera_id,
                # plate_* vacíos porque esto es facial
                plate_raw="",
                plate_norm="",
                score=None,
                decision="ERROR_OCR",
                reason=f"rekognition_error: {e.__class__.__name__}: {e}",
                vehicle=None,
                visit=None,
                payload={"error": str(e)},
                triggered_by=getattr(request, "user", None),
                # si tu modelo tiene estos campos, se guardan; si no, se ignoran abajo
                **({"direction": direction} if hasattr(AccessEvent, "direction") else {}),
                **({"opened": False} if hasattr(AccessEvent, "opened") else {}),
            )
            # snapshot opcional
            if hasattr(evt, "snapshot"):
                try:
                    evt.snapshot.save(f"face_{evt.id}.jpg", ContentFile(img_bytes), save=True)
                except Exception:
                    pass
            return Response({"ok": False, "event": AccessEventSerializer(evt).data}, status=502)

        matches = result.get("Matches", []) or []
        match = bool(matches)
        best = matches[0] if match else None

        # --- 2) Decidir (umbral configurable)
        # si result devuelve Similarity en % (0..100), lo pasamos a 0..1
        score = (best["Similarity"] / 100.0) if match else None
        threshold = float(getattr(settings, "FACE_ALLOW_THRESHOLD", 0.85))
        allow = bool(match and score is not None and score >= threshold)

        # intentar resolver usuario: ExternalImageId puede venir "resident:31" o "31"
        external_id = (best.get("ExternalImageId") if match else "") or ""
        user_id = None
        m = re.search(r"(\d+)", str(external_id))
        if m:
            try:
                user_id = int(m.group(1))
            except Exception:
                user_id = None

        matched_user = None
        if user_id:
            matched_user = User.objects.filter(id=user_id).first()

        decision = "ALLOW_RESIDENT" if allow and matched_user else "DENY_UNKNOWN"
        reason = (
            f"match {external_id} (id={getattr(matched_user, 'id', None)})"
            if match else "no_match"
        )
        opened = bool(decision == "ALLOW_RESIDENT")

        # --- 3) Registrar evento (reutilizando AccessEvent)
        extra_kwargs = {}
        if hasattr(AccessEvent, "direction"):
            extra_kwargs["direction"] = direction
        if hasattr(AccessEvent, "opened"):
            extra_kwargs["opened"] = opened

        evt = AccessEvent.objects.create(
            camera_id=camera_id,
            plate_raw="",
            plate_norm="",
            score=score,
            decision=decision,
            reason=reason,
            vehicle=None,
            visit=None,
            payload={
                "rekognition": result,
                "best": best,
                "external_id": external_id,
                "matched_user_id": getattr(matched_user, "id", None),
                "threshold": threshold,
            },
            triggered_by=getattr(request, "user", None),
            **extra_kwargs,
        )
        # snapshot si tu modelo lo soporta
        if hasattr(evt, "snapshot"):
            try:
                evt.snapshot.save(f"face_{evt.id}.jpg", ContentFile(img_bytes), save=True)
            except Exception:
                pass

        # --- 4) Respuesta (con tarjetita mínima del usuario si lo encontramos)
        resident = None
        if matched_user:
            resident = {
                "id": matched_user.id,
                "username": getattr(matched_user, "username", ""),
                "email": getattr(matched_user, "email", ""),
                "name": f"{getattr(matched_user,'first_name','') or ''} {getattr(matched_user,'last_name','') or ''}".strip() or getattr(matched_user,"username",""),
            }

        return Response({
            "ok": True,
            "match": match,
            "best": best,
            "candidates": matches,
            "resident": resident,
            "event": AccessEventSerializer(evt).data
        })
