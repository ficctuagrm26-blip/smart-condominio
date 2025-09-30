from __future__ import annotations
from rest_framework.viewsets import GenericViewSet
# DRF base
from rest_framework import status, permissions, viewsets, filters, serializers, generics, mixins
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.mixins import CreateModelMixin, ListModelMixin, RetrieveModelMixin
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

# Django
from django.utils.dateparse import parse_date
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.db import models, transaction, IntegrityError
from django.db.models import Q, Sum, F, DecimalField, ExpressionWrapper
from django.db.models.deletion import ProtectedError, RestrictedError
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

# stdlib
import csv
import uuid
from datetime import date, datetime, timedelta, time
from decimal import Decimal

# Filtros
from django_filters.rest_framework import DjangoFilterBackend

# Modelos
from .models import (
    Rol, Profile, Unidad, Cuota, Pago, Infraccion,
    Visitor, Visit,
    OnlinePaymentIntent, MockReceipt,
    Vehiculo, SolicitudVehiculo,
    Aviso, AreaComun, AreaDisponibilidad, ReservaArea,
    Tarea, TareaComentario,
    # ⬇️ AÑADE el modelo nuevo del flujo de comprobantes
    PagoComprobante, AccessEvent, FaceAccessEvent
)

# Permisos
from .permissions import (
    IsAdmin, IsStaff, user_role_code, has_role_permission,
    # ⬇️ AÑADE estos que usas en PagoComprobanteViewSet
    IsResident, IsAdminOrStaff,
    IsStaffGuardOrAdmin,
)

# Serializers
from .serializers import (
    # auth / perfil
    RegisterSerializer, MeSerializer, AdminUserSerializer, MeUpdateSerializer, ChangePasswordSerializer,
    # roles / permisos
    RolSimpleSerializer, PermissionBriefSerializer,
    # unidades / cuotas / pagos
    UnidadSerializer, CuotaSerializer, PagoCreateSerializer, PagoSerializer, GenerarCuotasSerializer,
    # infracciones
    InfraccionSerializer,
    # estado de cuenta
    PagoEstadoCuentaSerializer, UnidadBriefECSerializer,
    # tareas
    TareaSerializer, TareaWriteSerializer, TareaComentarioSerializer,
    # visitantes / visitas
    VisitorSerializer, VisitSerializer, VisitWriteSerializer,
    VisitApproveSerializer, VisitDenySerializer, VisitCheckInSerializer, VisitCheckOutSerializer,
    # pagos online mock
    OnlinePaymentIntentSerializer, MockReceiptSerializer,
    # áreas comunes
    AreaComunSerializer, DisponibilidadResponseSerializer,
    # vehículos
    VehiculoSerializer, SolicitudVehiculoCreateSerializer,
    SolicitudVehiculoListSerializer, SolicitudVehiculoReviewSerializer,
    # ⬇️ AÑADE los serializers del flujo de comprobantes
    PagoComprobanteCreateSerializer, PagoComprobanteListSerializer, PagoComprobanteReviewSerializer, AvisoCreateUpdateSerializer, AvisoReadSerializer,
    SnapshotInSerializer, 
    AccessEventSerializer, FaceAccessEventSerializer,
    
)
from .services_snapshot import PlateRecognizerSnapshot, best_plate_from_result  # ⬅️ AÑADIR


User = get_user_model()

# ---------------------------
# Helpers comunes
# ---------------------------

def _unidad_display(u: Unidad) -> str:
    b = f"-{u.lote}" if u.lote else ""
    return f"Mza {u.manzana}{b}-{u.numero}"

def _cuota_es_del_usuario(cuota: Cuota, user: User) -> bool:
    u = cuota.unidad
    return (u and (u.propietario_id == user.id or u.residente_id == user.id))

def _is_admin_or_staff(user: User) -> bool:
    return bool(getattr(user, "is_superuser", False) or user_role_code(user) in {"ADMIN", "STAFF"})

def _unidades_del_usuario_q(user: User) -> Q:
    return Q(propietario=user) | Q(residente=user)


# ---------------------------
# Auth / Perfil
# ---------------------------

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        data = AdminUserSerializer(user).data
        return Response(
            {"status": 1, "error": 0, "message": "REGISTRO EXITOSO", "values": {"user": data}},
            status=status.HTTP_201_CREATED,
        )

@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(MeSerializer(request.user).data)

@api_view(["PATCH"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def me_update(request):
    ser = MeUpdateSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    user = ser.save()
    return Response(MeSerializer(user).data)

@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def change_password(request):
    ser = ChangePasswordSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response({"detail": "Contraseña actualizada correctamente."})


# ---------------------------
# Admin de usuarios
# ---------------------------

class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("profile__role").all().order_by("id")
    serializer_class = AdminUserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["username", "first_name", "last_name", "email", "profile__role__code", "profile__role__name"]
    ordering_fields = ["id", "username", "email", "first_name", "last_name", "is_active"]
    filterset_fields = ["is_active", "is_superuser", "profile__role__code"]

    def get_queryset(self):
        qs = super().get_queryset()
        group = self.request.query_params.get("group")
        if group == "residents":
            qs = qs.filter(profile__role__base="RESIDENT")
        elif group == "staff":
            qs = qs.filter(profile__role__base="STAFF").exclude(is_superuser=True)
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.pk == request.user.pk:
            return Response({"detail": "No puedes eliminar tu propia cuenta."}, status=400)
        if getattr(instance, "is_superuser", False) and not getattr(request.user, "is_superuser", False):
            return Response({"detail": "Solo un superusuario puede eliminar a otro superusuario."}, status=403)
        if getattr(instance, "is_superuser", False) and not User.objects.filter(is_superuser=True, is_active=True).exclude(pk=instance.pk).exists():
            return Response({"detail": "No se puede eliminar el último superusuario activo."}, status=400)
        try:
            self.perform_destroy(instance)
        except (ProtectedError, RestrictedError):
            return Response({"detail": "No se puede eliminar: integridad referencial."}, status=409)
        except IntegrityError as e:
            return Response({"detail": "Error de integridad.", "error": str(e)}, status=409)
        except Exception as e:
            return Response({"detail": "Error inesperado.", "error": str(e)}, status=400)
        return Response(status=204)

    @action(detail=False, methods=["get"], url_path="residents")
    def residents(self, request):
        qs = self.filter_queryset(self.get_queryset().filter(profile__role__base="RESIDENT"))
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page or qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=False, methods=["get"], url_path="staff")
    def staff(self, request):
        qs = self.filter_queryset(self.get_queryset().filter(profile__role__base="STAFF").exclude(is_superuser=True))
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page or qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)


# ---------------------------
# Roles / Permisos
# ---------------------------

class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all().order_by("code")
    serializer_class = RolSimpleSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def destroy(self, request, *args, **kwargs):
        rol = self.get_object()
        if getattr(rol, "is_system", False):
            return Response({"detail": "No se puede borrar un rol de sistema."}, status=400)
        if Profile.objects.filter(role=rol).exists():
            return Response({"detail": "No se puede borrar: hay usuarios con este rol."}, status=400)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="add-permissions")
    def add_permissions(self, request, pk=None):
        rol = self.get_object()
        ids = request.data.get("permission_ids", [])
        perms = Permission.objects.filter(id__in=ids)
        rol.permissions.add(*perms)
        return Response(self.get_serializer(rol).data)

    @action(detail=True, methods=["post"], url_path="remove-permissions")
    def remove_permissions(self, request, pk=None):
        rol = self.get_object()
        ids = request.data.get("permission_ids", [])
        perms = Permission.objects.filter(id__in=ids)
        rol.permissions.remove(*perms)
        return Response(self.get_serializer(rol).data)

    @action(detail=True, methods=["get"], url_path="permissions")
    def list_permissions(self, request, pk=None):
        rol = self.get_object()
        perms = rol.permissions.select_related("content_type").all().order_by("content_type__app_label", "codename")
        data = PermissionBriefSerializer(perms, many=True).data
        return Response(data)

class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.select_related("content_type").all().order_by("content_type__app_label", "codename")
    serializer_class = PermissionBriefSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ["codename", "name", "content_type__app_label", "content_type__model"]


# ---------------------------
# Unidades
# ---------------------------

class UnidadViewSet(viewsets.ModelViewSet):
    queryset = Unidad.objects.select_related("propietario", "residente").all()
    serializer_class = UnidadSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "manzana": ["exact", "icontains"],
        "lote": ["exact", "icontains"],
        "estado": ["exact"],
        "tipo": ["exact"],
        "is_active": ["exact"],
        "propietario": ["exact"],
        "residente": ["exact"],
    }
    search_fields = ["manzana", "lote", "numero"]
    ordering_fields = ["manzana", "lote", "numero", "updated_at"]
    ordering = ["manzana", "lote", "numero"]

    def get_queryset(self):
        qs = super().get_queryset()
        # compat con ?torre=&bloque= desde FE antiguo
        torre = self.request.query_params.get("torre")
        bloque = self.request.query_params.get("bloque")
        if torre:
            qs = qs.filter(manzana__icontains=torre)
        if bloque:
            qs = qs.filter(lote__icontains=bloque)
        return qs

    @action(methods=["post"], detail=True, url_path="desactivar")
    def desactivar(self, request, pk=None):
        obj = self.get_object()
        obj.is_active = False
        obj.estado = "INACTIVA"
        obj.save(update_fields=["is_active", "estado"])
        return Response(self.get_serializer(obj).data)

    @action(methods=["post"], detail=True, url_path="asignar")
    def asignar(self, request, pk=None):
        obj = self.get_object()
        ser = self.get_serializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(self.get_serializer(obj).data)


# ---------------------------
# Cuotas / Pagos
# ---------------------------

class CuotaViewSet(viewsets.ModelViewSet):
    queryset = Cuota.objects.select_related("unidad", "unidad__propietario", "unidad__residente").all()
    serializer_class = CuotaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        "unidad", "periodo", "concepto", "estado", "is_active",
        "unidad__manzana", "unidad__lote", "unidad__numero",
    ]
    search_fields = ["periodo", "concepto", "unidad__manzana", "unidad__lote", "unidad__numero"]
    ordering_fields = ["vencimiento", "updated_at", "total_a_pagar", "pagado", "periodo", "unidad"]
    ordering = ["-periodo", "unidad_id"]

    def _solo_mias(self, qs, user):
        return qs.filter(_unidades_del_usuario_q(user)).distinct()

    def get_queryset(self):
        qs = super().get_queryset().filter(is_active=True)
        u = self.request.user
        if getattr(u, "is_superuser", False) or user_role_code(u) in {"ADMIN", "STAFF"}:
            return qs
        return self._solo_mias(qs, u)

    def get_serializer_class(self):
        if getattr(self, "action", None) == "generar":
            return GenerarCuotasSerializer
        return super().get_serializer_class()

    @action(detail=False, methods=["post"], url_path="generar")
    def generar(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        periodo = data["periodo"]
        concepto = data["concepto"]
        monto_base = data["monto_base"]
        usa_coef = data["usa_coeficiente"]
        venc = data["vencimiento"]

        afectadas = []
        for u in Unidad.objects.filter(is_active=True).only("id", "coeficiente"):
            c, _ = Cuota.objects.get_or_create(
                unidad=u, periodo=periodo, concepto=concepto, is_active=True,
                defaults={
                    "monto_base": monto_base,
                    "usa_coeficiente": usa_coef,
                    "coeficiente_snapshot": u.coeficiente or 0,
                    "vencimiento": venc,
                }
            )
            c.monto_base = monto_base
            c.usa_coeficiente = usa_coef
            if usa_coef:
                c.coeficiente_snapshot = u.coeficiente or 0
            c.vencimiento = venc
            c.recalc_importes()
            c.recalc_estado()
            c.save(update_fields=[
                "monto_base", "usa_coeficiente", "coeficiente_snapshot",
                "vencimiento", "monto_calculado", "total_a_pagar", "estado", "updated_at"
            ])
            afectadas.append(c.id)

        return Response({"ok": True, "cuotas_afectadas": afectadas, "total": len(afectadas)}, status=201)

    @action(detail=True, methods=["post"], url_path="pagos")
    def registrar_pago(self, request, pk=None):
        cuota = self.get_object()
        u = request.user
        if not getattr(u, "is_superuser", False):
            if not _cuota_es_del_usuario(cuota, u):
                return Response({"detail": "No autorizado sobre esta cuota."}, status=403)
        data = {**request.data, "cuota": cuota.id}
        ser = PagoCreateSerializer(data=data, context={"request": request})
        ser.is_valid(raise_exception=True)
        pago = ser.save()
        return Response(PagoSerializer(pago).data, status=201)

class PagoViewSet(viewsets.ModelViewSet):
    queryset = Pago.objects.select_related("cuota", "creado_por").all()
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["cuota", "valido", "medio"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        return PagoCreateSerializer if self.action == "create" else PagoSerializer

    def create(self, request, *args, **kwargs):
        ser_in = self.get_serializer(data=request.data, context={"request": request})
        ser_in.is_valid(raise_exception=True)
        pago = ser_in.save()
        ser_out = PagoSerializer(pago, context={"request": request})
        return Response(ser_out.data, status=201)


# ---------------------------
# Infracciones
# ---------------------------

class InfraccionViewSet(viewsets.ModelViewSet):
    queryset = Infraccion.objects.select_related("unidad", "residente", "creado_por").all()
    serializer_class = InfraccionSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["unidad", "residente", "estado", "tipo", "is_active", "fecha"]
    search_fields = ["descripcion", "unidad__manzana", "unidad__lote", "unidad__numero"]
    ordering_fields = ["fecha", "monto", "updated_at"]
    ordering = ["-fecha"]

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)

    @action(detail=True, methods=["post"])
    def resolver(self, request, pk=None):
        obj = self.get_object()
        obj.estado = "RESUELTA"
        obj.save(update_fields=["estado", "updated_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def anular(self, request, pk=None):
        obj = self.get_object()
        obj.estado = "ANULADA"
        obj.is_active = False
        obj.save(update_fields=["estado", "is_active", "updated_at"])
        return Response(self.get_serializer(obj).data)


# ---------------------------
# Tareas (CU15 / CU24)
# ---------------------------

class TareaViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["estado", "prioridad", "asignado_a", "asignado_a_rol", "unidad", "is_active"]
    search_fields = ["titulo", "descripcion", "unidad__manzana", "unidad__lote", "unidad__numero", "creado_por__username", "asignado_a__username"]
    ordering_fields = ["updated_at", "created_at", "fecha_limite", "prioridad"]
    ordering = ["-updated_at", "-created_at"]

    def get_serializer_class(self):
        return TareaWriteSerializer if self.action in {"create", "update", "partial_update"} else TareaSerializer

    def get_queryset(self):
        u = self.request.user
        qs = Tarea.objects.select_related("asignado_a", "asignado_a_rol", "creado_por", "unidad")
        if getattr(u, "is_superuser", False) or user_role_code(u) in {"ADMIN", "STAFF"}:
            return qs
        mis_unidades = Unidad.objects.filter(_unidades_del_usuario_q(u)).values_list("id", flat=True)
        rol_id = getattr(getattr(getattr(u, "profile", None), "role", None), "id", None)
        return qs.filter(
            Q(creado_por=u) | Q(asignado_a=u) | Q(unidad_id__in=mis_unidades) | Q(asignado_a_rol_id=rol_id)
        ).distinct()

    def perform_create(self, serializer):
        u = self.request.user
        is_admin = getattr(u, "is_superuser", False) or user_role_code(u) == "ADMIN"
        can_manage = has_role_permission(u, "manage_tasks")
        if not (is_admin or can_manage):
            raise PermissionDenied("No autorizado para crear tareas.")
        obj = serializer.save(creado_por=u)
        if obj.asignado_a and obj.estado == "NUEVA":
            obj.estado = "ASIGNADA"
            obj.save(update_fields=["estado", "updated_at"])

    def update(self, request, *args, **kwargs):
        instancia = self.get_object()
        u = request.user
        is_admin = getattr(u, "is_superuser", False) or user_role_code(u) == "ADMIN"
        can_manage = has_role_permission(u, "manage_tasks")
        is_staff_manage = is_admin or can_manage

        partial = kwargs.pop("partial", False)
        ser = self.get_serializer(instancia, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)

        if not is_staff_manage and instancia.asignado_a_id != u.id:
            return Response({"detail": "Solo el asignado puede actualizar la tarea."}, status=403)

        if not is_staff_manage:
            allowed = {"descripcion", "estado", "checklist"}
            dirty = set(ser.validated_data.keys()) - allowed
            if dirty:
                return Response({"detail": f"Como asignado, solo puedes modificar: {', '.join(sorted(allowed))}."}, status=403)

        self.perform_update(ser)
        return Response(TareaSerializer(instancia).data)

    @action(detail=True, methods=["post"])
    def asignar(self, request, pk=None):
        if not (getattr(request.user, "is_superuser", False) or user_role_code(request.user) in {"ADMIN", "STAFF"}):
            return Response({"detail": "No autorizado."}, status=403)
        obj = self.get_object()
        uid = request.data.get("user_id")
        rol_id = request.data.get("rol_id")
        if uid and rol_id:
            return Response({"detail": "Indique solo user_id o rol_id."}, status=400)
        obj.asignado_a_id = uid or None
        obj.asignado_a_rol_id = rol_id or None
        if uid and obj.estado == "NUEVA":
            obj.estado = "ASIGNADA"
        obj.save()
        return Response(TareaSerializer(obj).data)

    @action(detail=True, methods=["post"])
    def tomar(self, request, pk=None):
        obj = self.get_object()
        my_rol_id = getattr(getattr(getattr(request.user, "profile", None), "role", None), "id", None)
        if not my_rol_id or obj.asignado_a_rol_id != my_rol_id:
            return Response({"detail": "No puede tomar esta tarea."}, status=403)
        obj.asignado_a = request.user
        obj.asignado_a_rol = None
        if obj.estado in {"NUEVA", "ASIGNADA"}:
            obj.estado = "EN_PROGRESO"
        obj.save()
        return Response(TareaSerializer(obj).data)

    @action(detail=True, methods=["post"])
    def cambiar_estado(self, request, pk=None):
        obj = self.get_object()
        nuevo = request.data.get("estado")
        if nuevo not in dict(Tarea.ESTADO_CHOICES):
            return Response({"detail": "Estado inválido."}, status=400)
        u = request.user
        is_staff = getattr(u, "is_superuser", False) or user_role_code(u) in {"ADMIN", "STAFF"}
        if not is_staff and obj.asignado_a_id != u.id:
            return Response({"detail": "No autorizado."}, status=403)
        obj.estado = nuevo
        obj.save(update_fields=["estado", "updated_at"])
        return Response(TareaSerializer(obj).data)

    @action(detail=True, methods=["post"])
    def comentar(self, request, pk=None):
        obj = self.get_object()
        texto = (request.data.get("cuerpo") or "").strip()
        if not texto:
            return Response({"detail": "cuerpo requerido."}, status=400)
        c = TareaComentario.objects.create(tarea=obj, autor=request.user, cuerpo=texto)
        return Response(TareaComentarioSerializer(c).data, status=201)

    def destroy(self, request, *args, **kwargs):
        u = request.user
        is_admin = getattr(u, "is_superuser", False) or user_role_code(u) == "ADMIN"
        can_manage = has_role_permission(u, "manage_tasks")
        if not (is_admin or can_manage):
            return Response({"detail": "No autorizado para eliminar tareas."}, status=403)
        return super().destroy(request, *args, **kwargs)


# ---------------------------
# Estado de cuenta
# ---------------------------

class EstadoCuentaView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get_user_unidades(self, user):
        return Unidad.objects.filter(_unidades_del_usuario_q(user)).order_by("manzana", "lote", "numero")

    def get(self, request):
        user = request.user
        unidades = self.get_user_unidades(user)
        if not unidades.exists():
            return Response({"detail": "No tiene unidades asociadas."}, status=404)

        unidad_id = request.query_params.get("unidad")
        if unidad_id:
            unidad = unidades.filter(id=unidad_id).first()
            if not unidad:
                return Response({"detail": "Unidad inválida para este usuario."}, status=403)
        else:
            unidad = unidades.first()

        cuotas_qs = Cuota.objects.select_related("unidad").filter(unidad=unidad).order_by("-vencimiento", "-updated_at")
        pagos_qs = Pago.objects.select_related("cuota", "creado_por", "cuota__unidad").filter(cuota__unidad=unidad).order_by("-created_at")

        saldo_expr = ExpressionWrapper(F("total_a_pagar") - F("pagado"), output_field=DecimalField(max_digits=12, decimal_places=2))
        agg = cuotas_qs.aggregate(
            saldo_pendiente=Sum(saldo_expr),
            total_pagado=Sum("pagado"),
            total_cobrado=Sum("total_a_pagar"),
        )
        cuotas_pendientes = cuotas_qs.filter(estado__in=["PENDIENTE", "VENCIDA", "PARCIAL"]).count()
        ultimo_pago = pagos_qs.first()

        data = {
            "unidades": UnidadBriefECSerializer(unidades, many=True).data,
            "unidad": UnidadBriefECSerializer(unidad).data,
            "resumen": {
                "saldo_pendiente": str(agg.get("saldo_pendiente") or 0),
                "total_pagado_historico": str(agg.get("total_pagado") or 0),
                "total_cobrado_historico": str(agg.get("total_cobrado") or 0),
                "cuotas_pendientes": cuotas_pendientes,
                "ultimo_pago": PagoEstadoCuentaSerializer(ultimo_pago).data if ultimo_pago else None,
                "fecha_corte": date.today().isoformat(),
            },
            "cuotas": CuotaSerializer(cuotas_qs, many=True).data,
            "pagos": PagoEstadoCuentaSerializer(pagos_qs, many=True).data,
        }
        return Response(data, status=200)

class EstadoCuentaExportCSV(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get_user_unidades(self, user):
        return Unidad.objects.filter(_unidades_del_usuario_q(user)).order_by("manzana", "lote", "numero")

    def get(self, request):
        user = request.user
        unidades = self.get_user_unidades(user)
        if not unidades.exists():
            return Response({"detail": "No tiene unidades asociadas."}, status=404)

        unidad_id = request.query_params.get("unidad")
        if unidad_id:
            unidad = unidades.filter(id=unidad_id).first()
            if not unidad:
                return Response({"detail": "Unidad inválida para este usuario."}, status=403)
        else:
            unidad = unidades.first()

        cuotas_qs = Cuota.objects.select_related("unidad").filter(unidad=unidad).order_by("-vencimiento", "-updated_at")
        pagos_qs = Pago.objects.select_related("cuota", "cuota__unidad").filter(cuota__unidad=unidad).order_by("-created_at")

        resp = HttpResponse(content_type="text/csv")
        filename = f"estado_cuenta_unidad_{unidad.id}_{date.today().isoformat()}.csv"
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        writer = csv.writer(resp)

        writer.writerow([f"Estado de cuenta - Unidad {str(unidad)} (ID {unidad.id})"])
        writer.writerow(["Fecha de corte", date.today().isoformat()])
        writer.writerow([])

        writer.writerow(["CUOTAS"])
        writer.writerow(["ID", "Periodo", "Concepto", "Vencimiento", "Total", "Pagado", "Saldo", "Estado"])
        for c in cuotas_qs:
            saldo = (c.total_a_pagar or 0) - (c.pagado or 0)
            writer.writerow([c.id, c.periodo, c.concepto, c.vencimiento, c.total_a_pagar, c.pagado, saldo, c.estado])

        writer.writerow([])
        writer.writerow(["PAGOS"])
        writer.writerow(["ID", "Fecha pago", "Monto", "Medio", "Referencia", "Cuota (Periodo)", "Concepto"])
        for p in pagos_qs:
            writer.writerow([p.id, p.fecha_pago, p.monto, p.medio, p.referencia, getattr(p.cuota, "periodo", ""), getattr(p.cuota, "concepto", "")])

        return resp


# ---------------------------
# Avisos
# ---------------------------



# ---------------------------
# Áreas comunes (CU16)
# ---------------------------

class AreaComunViewSet(viewsets.ModelViewSet):
    queryset = AreaComun.objects.filter(activa=True)
    serializer_class = AreaComunSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in {"list", "retrieve", "disponibilidad"}:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]

    @action(detail=True, methods=["get"], url_path="disponibilidad")
    def disponibilidad(self, request, pk=None):
        area = self.get_object()
        date_str = request.query_params.get("date")
        if not date_str:
            return Response({"detail": "Parámetro 'date' (YYYY-MM-DD) es requerido."}, status=400)
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"detail": "Formato de 'date' inválido. Use YYYY-MM-DD."}, status=400)

        try:
            slot_minutes = int(request.query_params.get("slot", 60))
        except Exception:
            return Response({"detail": "Parámetro 'slot' inválido."}, status=400)

        override_start = request.query_params.get("from")
        override_end = request.query_params.get("to")
        tz = timezone.get_current_timezone()
        weekday = target_date.weekday()

        if override_start and override_end:
            try:
                s_h, s_m = map(int, override_start.split(":"))
                e_h, e_m = map(int, override_end.split(":"))
                windows = [(time(s_h, s_m), time(e_h, e_m))]
            except Exception:
                return Response({"detail": "Parámetros 'from'/'to' inválidos. Use HH:MM."}, status=400)
        else:
            reglas = list(AreaDisponibilidad.objects.filter(area=area, dia_semana=weekday).order_by("hora_inicio"))
            if not reglas:
                data = {"area_id": area.id, "date": target_date, "slot_minutes": slot_minutes, "windows": [], "slots": []}
                return Response(DisponibilidadResponseSerializer(data).data)
            windows = [(r.hora_inicio, r.hora_fin) for r in reglas]

        day_start = timezone.make_aware(datetime.combine(target_date, time(0, 0, 0)), tz)
        day_end = timezone.make_aware(datetime.combine(target_date, time(23, 59, 59)), tz)
        activas = ["PENDIENTE", "CONFIRMADA", "PAGADA"]
        reservas = list(
            ReservaArea.objects.filter(area=area, estado__in=activas)
            .filter(Q(fecha_inicio__lte=day_end) & Q(fecha_fin__gte=day_start))
            .order_by("fecha_inicio")
        )

        busy = sorted([(r.fecha_inicio, r.fecha_fin) for r in reservas], key=lambda x: x[0])
        merged = []
        for b in busy:
            if not merged or b[0] > merged[-1][1]:
                merged.append([b[0], b[1]])
            else:
                merged[-1][1] = max(merged[-1][1], b[1])
        busy = [(a, b) for a, b in merged]

        def to_dt(d, t):
            return timezone.make_aware(datetime.combine(d, t), tz)

        free_intervals = []
        for w_start, w_end in windows:
            w_s = to_dt(target_date, w_start)
            w_e = to_dt(target_date, w_end)
            cur = w_s
            for b_s, b_e in busy:
                if b_e <= cur or b_s >= w_e:
                    continue
                if b_s > cur:
                    free_intervals.append((cur, min(b_s, w_e)))
                cur = max(cur, b_e)
                if cur >= w_e:
                    break
            if cur < w_e:
                free_intervals.append((cur, w_e))

        slots = []
        step = timedelta(minutes=slot_minutes)
        for s, e in free_intervals:
            cur = s
            while cur + step <= e:
                slots.append({"start": cur, "end": cur + step})
                cur += step

        data = {
            "area_id": area.id,
            "date": target_date,
            "slot_minutes": slot_minutes,
            "windows": [{"start": w[0], "end": w[1]} for w in windows],
            "slots": slots,
        }
        return Response(DisponibilidadResponseSerializer(data).data)


# ---------------------------
# Staff (solo base STAFF)
# ---------------------------

class StaffViewSet(viewsets.ModelViewSet):
    serializer_class = AdminUserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = User.objects.select_related("profile", "profile__role").all().order_by("id")

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["username", "first_name", "last_name", "email", "profile__role__code", "profile__role__name"]
    ordering_fields = ["id", "username", "first_name", "last_name", "email"]

    def get_queryset(self):
        qs = super().get_queryset().filter(profile__role__base="STAFF").exclude(is_superuser=True)
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(email__icontains=q)
            )
        return qs

    def _ensure_staff_role(self, data: dict) -> dict:
        code = (data.get("role_code") or "").strip().upper()
        if not code:
            data["role_code"] = "STAFF"
            return data
        try:
            r = Rol.objects.get(code=code)
        except Rol.DoesNotExist:
            raise serializers.ValidationError({"role_code": "Rol no existe."})
        if r.base != "STAFF":
            raise serializers.ValidationError({"role_code": "Debe ser un rol de base STAFF."})
        return data

    def create(self, request, *args, **kwargs):
        data = self._ensure_staff_role(request.data.copy())
        ser = self.get_serializer(data=data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        role = Rol.objects.get(code=data["role_code"])
        Profile.objects.update_or_create(user=user, defaults={"role": role})
        return Response(self.get_serializer(user).data, status=201)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        data = self._ensure_staff_role(request.data.copy())
        partial = kwargs.pop("partial", False)
        ser = self.get_serializer(instance, data=data, partial=partial)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        role = Rol.objects.get(code=data["role_code"])
        Profile.objects.update_or_create(user=user, defaults={"role": role})
        return Response(self.get_serializer(user).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ---------------------------
# Visitantes / Visitas
# ---------------------------

class VisitorViewSet(viewsets.ModelViewSet):
    queryset = Visitor.objects.all().order_by("full_name")
    serializer_class = VisitorSerializer
    authentication_classes = [TokenAuthentication]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["full_name", "doc_number"]
    ordering_fields = ["full_name", "doc_number"]

    def get_permissions(self):
        return [IsAuthenticated()] if self.action in ["list", "retrieve"] else [IsAuthenticated(), IsStaff()]

class VisitViewSet(viewsets.ModelViewSet):
    queryset = Visit.objects.select_related("visitor", "unit", "host_resident").all()
    authentication_classes = [TokenAuthentication]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "unit", "host_resident", "approval_status"]
    search_fields = ["visitor__full_name", "visitor__doc_number", "vehicle_plate", "purpose"]
    ordering_fields = ["created_at", "entry_at", "exit_at"]

    def get_serializer_class(self):
        return VisitWriteSerializer if self.action in {"create", "update", "partial_update"} else VisitSerializer

    def get_permissions(self):
        staff_actions = {"create", "update", "partial_update", "destroy", "enter", "exit", "cancel", "deny"}
        if self.action in staff_actions:
            return [IsAuthenticated(), IsStaff()]
        if self.action in {"approve", "deny_approval", "approve_by_token"}:
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        u = self.request.user
        if self.request.query_params.get("mine") == "1":
            return qs.filter(host_resident=u)
        base = getattr(getattr(getattr(u, "profile", None), "role", None), "base", None)
        if getattr(u, "is_superuser", False) or base in {"STAFF", "ADMIN"}:
            return qs
        mis_unidades = Unidad.objects.filter(_unidades_del_usuario_q(u)).values_list("id", flat=True)
        return qs.filter(Q(host_resident=u) | Q(unit_id__in=mis_unidades)).distinct()

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        visit = self.get_object()
        if visit.host_resident_id != request.user.id:
            return Response({"detail": "No eres el anfitrión de esta visita."}, status=403)
        ser = VisitApproveSerializer(data=request.data or {})
        ser.is_valid(raise_exception=True)
        hours = ser.validated_data.get("hours_valid", 24)
        visit.approve(request.user, hours_valid=hours)
        visit.updated_by = request.user
        visit.save()
        return Response(VisitSerializer(visit, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="deny-approval")
    def deny_approval(self, request, pk=None):
        visit = self.get_object()
        if visit.host_resident_id != request.user.id:
            return Response({"detail": "No eres el anfitrión de esta visita."}, status=403)
        ser = VisitDenySerializer(data=request.data or {})
        ser.is_valid(raise_exception=True)
        visit.deny(request.user)
        visit.updated_by = request.user
        visit.save()
        return Response(VisitSerializer(visit, context={"request": request}).data)

    @action(detail=False, methods=["post"], url_path="approve-by-token")
    def approve_by_token(self, request):
        token = (request.data or {}).get("token")
        if not token:
            return Response({"detail": "Falta token."}, status=400)
        try:
            visit = Visit.objects.get(approval_token=token)
        except Visit.DoesNotExist:
            return Response({"detail": "Token inválido."}, status=404)
        if visit.host_resident_id != request.user.id:
            return Response({"detail": "No eres el anfitrión."}, status=403)
        hours = int((request.data or {}).get("hours_valid") or 24)
        visit.approve(request.user, hours_valid=hours)
        visit.updated_by = request.user
        visit.save()
        return Response(VisitSerializer(visit, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def enter(self, request, pk=None):
        visit = self.get_object()
        if visit.status not in ["REGISTRADO", "DENEGADO"]:
            return Response({"detail": "La visita no está en estado apto para ingreso."}, status=400)
        ser = VisitCheckInSerializer(data=request.data or {})
        ser.is_valid(raise_exception=True)
        force = ser.validated_data.get("force", False)
        try:
            visit.mark_entry(request.user, force=force)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        visit.updated_by = request.user
        visit.save()
        return Response(VisitSerializer(visit, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def exit(self, request, pk=None):
        visit = self.get_object()
        if visit.status != "INGRESADO":
            return Response({"detail": "La visita no está ingresada."}, status=400)
        visit.mark_exit(request.user)
        visit.updated_by = request.user
        visit.save()
        return Response(VisitSerializer(visit, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        visit = self.get_object()
        if visit.status in ["SALIDO", "CANCELADO"]:
            return Response({"detail": "La visita ya fue cerrada/cancelada."}, status=400)
        visit.status = "CANCELADO"
        visit.updated_by = request.user
        visit.save()
        return Response(VisitSerializer(visit, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def deny(self, request, pk=None):
        visit = self.get_object()
        if visit.status != "REGISTRADO":
            return Response({"detail": "Solo se puede denegar una visita registrada."}, status=400)
        visit.status = "DENEGADO"
        visit.updated_by = request.user
        visit.save()
        return Response(VisitSerializer(visit, context={"request": request}).data)



from django.urls import reverse

def _abs_url(request, path: str) -> str:
    base_url = getattr(settings, "SITE_URL", None) or request.build_absolute_uri("/").rstrip("/")
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{base_url}{path}"

class MockCheckoutView(APIView):
    """
    CU11 - Crear intento de pago (QR o “tarjeta” mock).
    POST { "cuota": <id>, "medio": "QR"|"CARD", "amount": opcional }
    Retorna:
      - id, amount, status, confirmation_url
      - qr_payload (si medio=QR, igual al confirmation_url)
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        user = request.user
        medio = (request.data.get("medio") or "QR").strip().upper()
        if medio not in {"QR", "CARD"}:
            return Response({"detail": "Medio inválido. Use QR o CARD."}, status=400)

        cuota = get_object_or_404(
            Cuota.objects.select_related("unidad"),
            pk=request.data.get("cuota"),
            is_active=True
        )

        # seguridad: la cuota debe ser del usuario (propietario o residente)
        if not _cuota_es_del_usuario(cuota, user):
            return Response({"detail": "No autorizado sobre esta cuota."}, status=403)

        # sin saldo → nada que pagar
        if cuota.estado == "PAGADA" or cuota.saldo <= 0:
            return Response({"detail": "No hay saldo pendiente."}, status=400)

        # amount opcional: si no viene o viene vacío → usar saldo actual
        try:
            amount_in = request.data.get("amount", None)
            if amount_in in (None, "", "null"):
                amount = Decimal(cuota.saldo)
            else:
                amount = Decimal(str(amount_in))
            if amount <= 0:
                return Response({"detail": "El monto debe ser > 0."}, status=400)
            if amount > cuota.saldo:
                amount = Decimal(cuota.saldo)
            amount = amount.quantize(Decimal("0.01"))
        except Exception:
            return Response({"detail": "Monto inválido."}, status=400)

        # Idempotencia: reusar intento pendiente del mismo usuario
        intent = (
            OnlinePaymentIntent.objects
            .select_for_update()
            .filter(
                cuota=cuota,
                creado_por=user,
                provider="MOCK",
                status__in=["CREATED", "PENDING"]
            )
            .order_by("-created_at")
            .first()
        )

        if intent is None:
            intent = OnlinePaymentIntent.objects.create(
                cuota=cuota,
                amount=amount,
                currency="BOB",
                provider="MOCK",
                status="PENDING",
                creado_por=user,
                metadata={
                    "unidad_display": _unidad_display(cuota.unidad),
                    "medio": medio
                },
            )
        else:
            # actualizar monto y medio
            intent.amount = amount
            meta = intent.metadata or {}
            meta["medio"] = medio
            intent.metadata = meta

        # siempre refrescamos el token y la URL de confirmación
        token = uuid.uuid4().hex
        intent.provider_id = token
        pay_path = reverse("api-mock-pay") + f"?intent={intent.id}&token={token}"
        pay_url = _abs_url(request, pay_path)
        intent.confirmation_url = pay_url
        intent.qr_payload = pay_url if medio == "QR" else ""
        intent.save()

        # Si medio = CARD, simulamos autorización inmediata (sin recibo)
        if medio == "CARD":
            saldo = Decimal(cuota.saldo)
            monto = min(amount, saldo).quantize(Decimal("0.01"))
            if monto > 0:
                ser = PagoCreateSerializer(
                    data={
                        "cuota": cuota.id,
                        "monto": str(monto),
                        "medio": "TARJETA",
                        "referencia": f"CARD-{intent.provider_id}",
                    },
                    context={"request": request}
                )
                ser.is_valid(raise_exception=True)
                _ = ser.save()
            intent.status = "PAID"
            intent.paid_at = timezone.now()
            intent.save(update_fields=["status", "paid_at", "updated_at"])

        return Response(OnlinePaymentIntentSerializer(intent).data, status=201)

@method_decorator(csrf_exempt, name="dispatch")
class MockPayView(APIView):
    authentication_classes = []          # público (solo simulación de QR)
    permission_classes = [AllowAny]

    def get(self, request):
        intent_id = request.query_params.get("intent")
        token = request.query_params.get("token")
        if not intent_id or not token:
            return Response({"detail": "Faltan parámetros."}, status=400)

        intent = get_object_or_404(
            OnlinePaymentIntent.objects.select_related("cuota", "cuota__unidad", "creado_por"),
            pk=intent_id
        )
        if str(intent.provider_id) != str(token):
            return Response({"detail": "Token inválido."}, status=403)

        # ⚠️ NO exigir autenticación aquí; solo mostramos estado básico del intento.
        # El upload del comprobante SI exige token (en /mock/receipt/).

        payload = OnlinePaymentIntentSerializer(intent).data
        payload["message"] = (
            "QR leído correctamente. Abre la app e ingresa a 'Mis pagos' para subir tu comprobante."
            if (intent.metadata or {}).get("medio") == "QR" and intent.status != "PAID"
            else "Intento confirmado."
        )

        # Opcional: no expongas datos sensibles de la unidad si lo deseas:
        # del payload["cuota"]  # si quieres ocultar
        return Response(payload, status=200)


class MockUploadReceiptView(APIView):
    """
    Residente sube comprobante del pago para verificación.
    POST { "intent": <id>, "receipt_url": "...", "amount": "200.00", "reference": "ABC", "bank_name": "Banco X" }
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        user = request.user
        intent = get_object_or_404(
            OnlinePaymentIntent.objects.select_related("cuota", "cuota__unidad"),
            pk=request.data.get("intent"),
            status__in=["CREATED", "PENDING"],
        )
        if not (intent.creado_por_id == user.id and _cuota_es_del_usuario(intent.cuota, user)):
            return Response({"detail": "No autorizado."}, status=403)

        amount = request.data.get("amount")
        if amount not in (None, ""):
            try:
                if Decimal(str(amount)) <= 0:
                    return Response({"detail": "El monto debe ser mayor a 0."}, status=400)
            except Exception:
                return Response({"detail": "Monto inválido."}, status=400)

        ser = MockReceiptSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        rec = ser.save()
        if getattr(rec, "uploaded_by_id", None) != user.id:
            rec.uploaded_by = user
            rec.save(update_fields=["uploaded_by"])
        return Response(MockReceiptSerializer(rec).data, status=201)


class MockVerifyReceiptView(APIView):
    """
    Admin/Staff revisa y aprueba/rechaza comprobante.
    POST { "receipt_id": <id>, "approve": true|false, "amount": opcional, "note": opcional }
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        if not _is_admin_or_staff(request.user):
            return Response({"detail": "No autorizado."}, status=403)

        approve = bool(request.data.get("approve"))
        rec = get_object_or_404(
            MockReceipt.objects.select_related("intent", "intent__cuota", "intent__cuota__unidad"),
            pk=request.data.get("receipt_id")
        )
        intent = rec.intent
        cuota = intent.cuota

        if not approve:
            if intent.status != "PAID":
                intent.status = "FAILED"
                intent.save(update_fields=["status"])
            return Response({"detail": "Comprobante rechazado."})

        if intent.status == "PAID":
            return Response({"detail": "Ya estaba aprobado."}, status=200)

        # Monto: preferir el del recibo; si no, el del intent; cap a saldo
        try:
            monto = Decimal(rec.amount or intent.amount or Decimal("0.00"))
        except Exception:
            return Response({"detail": "Monto inválido."}, status=400)
        if monto <= 0:
            return Response({"detail": "El monto debe ser mayor a 0."}, status=400)

        saldo = Decimal(cuota.saldo)
        if saldo <= 0:
            intent.status = "PAID"
            intent.paid_at = timezone.now()
            intent.save(update_fields=["status", "paid_at"])
            return Response({"detail": "La cuota ya no tiene saldo. Intent marcado como pagado."}, status=200)

        if monto > saldo:
            monto = saldo
        monto = Decimal(monto).quantize(Decimal("0.01"))

        ser = PagoCreateSerializer(
            data={
                "cuota": cuota.id,
                "monto": str(monto),
                "medio": "TRANSFERENCIA",
                "referencia": rec.reference or f"MOCK-{intent.provider_id}",
            },
            context={"request": request}
        )
        ser.is_valid(raise_exception=True)
        pago = ser.save()

        intent.status = "PAID"
        intent.paid_at = timezone.now()
        intent.save(update_fields=["status", "paid_at"])

        return Response({"detail": "Aprobado", "pago": PagoSerializer(pago).data}, status=200)


class MockIntentMineView(APIView):
    """
    GET: lista los intents del usuario autenticado (útil para FE)
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (OnlinePaymentIntent.objects
              .select_related("cuota", "cuota__unidad")
              .filter(creado_por=request.user)
              .order_by("-created_at"))
        return Response(OnlinePaymentIntentSerializer(qs, many=True).data, status=200)


class MockIntentDashboardView(APIView):
    """
    GET: dashboard básico para ADMIN/STAFF con pendientes
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_admin_or_staff(request.user):
            return Response({"detail": "No autorizado."}, status=403)
        qs = (OnlinePaymentIntent.objects
              .select_related("cuota", "cuota__unidad", "creado_por")
              .filter(provider="MOCK")
              .exclude(status="PAID")
              .order_by("-created_at"))
        return Response(OnlinePaymentIntentSerializer(qs, many=True).data, status=200)

# ---------------------------
# Vehículos / Solicitudes
# ---------------------------

class VehiculoViewSet(viewsets.ModelViewSet):
    queryset = Vehiculo.objects.select_related("propietario", "unidad").all().order_by("-id")
    serializer_class = VehiculoSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["activo", "unidad", "propietario", "tipo"]
    search_fields = ["placa", "marca", "modelo", "color"]
    ordering_fields = ["created_at", "updated_at", "placa"]

    def get_queryset(self):
        qs = super().get_queryset()
        u = self.request.user

        # Admin/Staff ven todos; si ?mine=1, solo los suyos
        if getattr(u, "is_superuser", False) or user_role_code(u) in {"ADMIN", "STAFF"}:
            if self.request.query_params.get("mine") == "1":
                return qs.filter(propietario=u)
            return qs

        # Residentes: solo sus vehículos
        return qs.filter(propietario=u)

class SolicitudVehiculoViewSet(viewsets.ModelViewSet):
    queryset = SolicitudVehiculo.objects.all().order_by("-created_at")
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["estado", "unidad", "solicitante"]
    search_fields = ["placa", "marca", "modelo", "color"]
    ordering_fields = ["created_at", "estado"]

    def get_serializer_class(self):
        if self.action == "create":
            return SolicitudVehiculoCreateSerializer
        if self.action in {"review"}:
            return SolicitudVehiculoReviewSerializer
        return SolicitudVehiculoListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        u = self.request.user
        return qs if _is_admin_or_staff(u) else qs.filter(solicitante=u)

    def perform_create(self, serializer):
        u = self.request.user
        # intenta vincular automáticamente a alguna unidad del usuario (si existe)
        unidad = Unidad.objects.filter(_unidades_del_usuario_q(u)).first()
        serializer.save(solicitante=u, unidad=unidad)

    @action(detail=True, methods=["post"], url_path="review", permission_classes=[IsAuthenticated, IsStaff])
    def review(self, request, pk=None):
        obj = self.get_object()
        ser = SolicitudVehiculoReviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        accion = ser.validated_data["accion"]
        observ = ser.validated_data.get("observaciones", "")
        if accion == "aprobar":
            veh = obj.aprobar(request.user, unidad=obj.unidad, observ=observ)
            return Response({"detail": "Aprobada", "vehiculo_id": veh.id})
        obj.rechazar(request.user, observ=observ)
        return Response({"detail": "Rechazada"})


# ---------------------------
# IA / Placeholders
# ---------------------------

class SnapshotPingView(APIView):
    """
    Salud de integración (probar token/permiso rápido).
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsStaffGuardOrAdmin]

    def post(self, request):
        role_code = getattr(getattr(getattr(request.user, "profile", None), "role", None), "code", None)
        return Response({"ok": True, "user": request.user.username, "role": role_code})


class SnapshotCheckView(APIView):
    """
    Recibe una imagen (multipart 'image'), opcional 'camera_id',
    consulta Plate Recognizer y decide:
      - ALLOW_RESIDENT | ALLOW_VISIT | DENY_UNKNOWN | ERROR_OCR
    También etiqueta el evento con direction según camera_id (ENTRADA/SALIDA).
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsStaffGuardOrAdmin]

    @transaction.atomic
    def post(self, request):
        ser = SnapshotInSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        camera_id = ser.validated_data.get("camera_id") or ""
        img = ser.validated_data["image"]

        # Dirección según la cámara (si no está mapeada, queda vacío)
        direction = ser.validated_data.get("direction") or \
            (getattr(settings, "CAMERA_DIRECTIONS", {}) or {}).get(camera_id, "")

        # 1) OCR externo
        try:
            payload = PlateRecognizerSnapshot.read_image(
                fileobj=img,
                regions=getattr(settings, "PLATE_REGIONS", None),
                camera_id=camera_id or None,
                timeout=12,
            )
        except Exception as e:
            ev = AccessEvent.objects.create(
                camera_id=camera_id,
                direction=direction,            # ⬅️ guardamos igual la dirección
                decision="ERROR_OCR",
                reason=f"OCR error: {e}",
                opened=False,
                payload={"error": str(e)},
                triggered_by=request.user,
            )
            return Response(AccessEventSerializer(ev).data, status=502)

        # 2) Mejor match de placa
        plate_raw, score = best_plate_from_result(payload)
        plate_norm = (plate_raw or "").strip().upper().replace(" ", "")

        if not plate_norm:
            ev = AccessEvent.objects.create(
                camera_id=camera_id,
                direction=direction,
                plate_raw=plate_raw or "",
                plate_norm="",
                score=score,
                decision="DENY_UNKNOWN",
                reason="Sin placa confiable",
                opened=False,
                payload=payload,
                triggered_by=request.user,
            )
            return Response(AccessEventSerializer(ev).data)

        # 3) Matching con Vehiculo/Visit
        now = timezone.now()
        veh = Vehiculo.objects.filter(placa__iexact=plate_norm, activo=True).first()
        visit = (
            Visit.objects.filter(
                vehicle_plate__iexact=plate_norm,
                approval_status="APR",
                status__in=["REGISTRADO", "INGRESADO"],
            )
            .filter(
                # sin expiración o vigente
                (Q(approval_expires_at__isnull=True) | Q(approval_expires_at__gte=now))
            )
            .order_by("-created_at")
            .first()
        )

        decision, reason, opened = (
            "DENY_UNKNOWN",
            "No coincide con vehículo autorizado ni visita aprobada.",
            False,
        )
        if veh:
            decision, reason, opened = (
                "ALLOW_RESIDENT",
                f"Vehículo autorizado para usuario {veh.propietario_id}.",
                True,
            )
        elif visit:
            decision, reason, opened = (
                "ALLOW_VISIT",
                f"Visita aprobada (id={visit.id}).",
                True,
            )

        ev = AccessEvent.objects.create(
            camera_id=camera_id,
            direction=direction,          # ⬅️ importante
            plate_raw=plate_raw or "",
            plate_norm=plate_norm,
            score=score,
            decision=decision,
            reason=reason,
            opened=opened,
            vehicle=veh,
            visit=visit,
            payload=payload,
            triggered_by=request.user,
            
        )
        return Response(AccessEventSerializer(ev).data)

class MyCuotasConSaldoView(ListAPIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = CuotaSerializer

    def get_queryset(self):
        u = self.request.user
        # queryset base con los select_related útiles
        qs = Cuota.objects.select_related("unidad", "unidad__propietario", "unidad__residente").filter(is_active=True)

        # Si no es admin/staff, limitar a sus unidades (propietario o residente)
        if not (getattr(u, "is_superuser", False) or user_role_code(u) in {"ADMIN", "STAFF"}):
            qs = qs.filter(_unidades_del_usuario_q(u))

        # Solo con saldo > 0
        qs = qs.exclude(total_a_pagar__lte=F("pagado"))
        return qs.order_by("vencimiento", "unidad_id")
    
    
# ---- CUOTAS PAGABLES (solo las del usuario con saldo>0) ----
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, F

class QRPayableCuotasView(APIView):
    """
    GET: Lista de cuotas del usuario autenticado con saldo > 0,
    con status del último intento (si existe). Pensado para mostrar
    “lo que debo pagar” y el botón de pagar por QR.
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import Unidad, Cuota, OnlinePaymentIntent
        u = request.user

        # Unidades del usuario (propietario o residente)
        unidad_ids = list(
            Unidad.objects.filter(Q(propietario=u) | Q(residente=u), is_active=True)
            .values_list("id", flat=True)
        )

        # Cuotas activas con saldo > 0 de esas unidades
        cuotas = (
            Cuota.objects.select_related("unidad")
            .filter(is_active=True, unidad_id__in=unidad_ids)
            .exclude(total_a_pagar__lte=F("pagado"))
            .order_by("vencimiento", "unidad_id")
        )

        out = []
        for c in cuotas:
            # Último intento (si existe) del mismo usuario
            last_intent = (
                OnlinePaymentIntent.objects.filter(cuota=c, creado_por=u)
                .order_by("-created_at").first()
            )
            out.append({
                "id": c.id,
                "unidad": str(c.unidad),
                "periodo": c.periodo,
                "concepto": c.concepto,
                "total_a_pagar": str(c.total_a_pagar or "0.00"),
                "pagado": str(c.pagado or "0.00"),
                "saldo": str((c.total_a_pagar or 0) - (c.pagado or 0)),
                "vencimiento": c.vencimiento.isoformat() if c.vencimiento else None,
                "estado": c.estado,  # PENDIENTE/PARCIAL/VENCIDA
                "ultimo_intento": {
                    "id": getattr(last_intent, "id", None),
                    "status": getattr(last_intent, "status", None),  # CREATED/PENDING/PAID/FAILED
                    "qr_payload": getattr(last_intent, "qr_payload", "") or "",
                    "confirmation_url": getattr(last_intent, "confirmation_url", "") or "",
                } if last_intent else None
            })
        return Response(out, status=200)

class PagoComprobanteViewSet(CreateModelMixin, ListModelMixin, RetrieveModelMixin, GenericViewSet):
    """
    Residentes: crean y ven SOLO sus comprobantes.
    Admin/Staff: ven todos, filtran por estado y revisan (aprobar/rechazar).
    """
    queryset = PagoComprobante.objects.select_related("cuota", "cuota__unidad", "residente", "pago")
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in {"create"}:
            return PagoComprobanteCreateSerializer
        return PagoComprobanteListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        u = self.request.user
        # Filtros simples por query params
        estado = self.request.query_params.get("estado")
        mine = self.request.query_params.get("mine")
        is_admin = IsAdminOrStaff().has_permission(self.request, self)

        if is_admin:
            if estado:
                qs = qs.filter(estado=estado.upper())
            return qs

        # residente: solo los suyos
        qs = qs.filter(residente=u)
        if estado:
            qs = qs.filter(estado=estado.upper())
        # por defecto, si ?mine=1 no cambia nada (ya es "míos")
        return qs

    def perform_create(self, serializer):
        # Restringe a residentes (o propietario/residente de la unidad)
        if not IsResident().has_permission(self.request, self) and not self.request.user.is_superuser:
            # Puedes permitir ADMIN también si quieres
            raise PermissionDenied("Solo residentes pueden enviar comprobantes.")
        serializer.save()

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAdminOrStaff])
    def review(self, request, pk=None):
        """
        POST /api/pagos/comprobantes/{id}/review/
        body: { "accion": "aprobar"|"rechazar", "monto_aprobado"?: number, "razon_rechazo"?: string }
        """
        comp = self.get_object()
        ser = PagoComprobanteReviewSerializer(data=request.data, context={"request": request, "comprobante": comp})
        ser.is_valid(raise_exception=True)
        comp = ser.save()
        return Response(PagoComprobanteListSerializer(comp).data, status=status.HTTP_200_OK)

class AvisoAdminViewSet(viewsets.ModelViewSet):
    """
    CRUD completo para admin.
    GET/POST /api/admin/avisos/
    GET/PATCH/DELETE /api/admin/avisos/{id}/
    Acciones: publicar, archivar
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsStaff]
    queryset = Aviso.objects.all()

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return AvisoReadSerializer
        return AvisoCreateUpdateSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search") or ""
        if search:
            qs = qs.filter(titulo__icontains=search) | qs.filter(cuerpo__icontains=search)
        ordering = self.request.query_params.get("ordering")
        if ordering:
            qs = qs.order_by(ordering)
        return qs

    @action(detail=True, methods=["post"])
    def publicar(self, request, pk=None):
        aviso = self.get_object()
        # si no tiene publish_at, lo publicamos ahora
        if not aviso.publish_at:
            aviso.publish_at = timezone.now()
        aviso.status = Aviso.Status.PUBLICADO
        aviso.save(update_fields=["status", "publish_at", "updated_at"])
        return Response(AvisoReadSerializer(aviso).data)

    @action(detail=True, methods=["post"])
    def archivar(self, request, pk=None):
        aviso = self.get_object()
        aviso.status = Aviso.Status.ARCHIVADO
        aviso.save(update_fields=["status", "updated_at"])
        return Response(AvisoReadSerializer(aviso).data)


class AvisoPublicViewSet(mixins.ListModelMixin,
                         mixins.RetrieveModelMixin,
                         viewsets.GenericViewSet):
    """
    Solo lectura (residentes). Devuelve únicamente avisos visibles.
    GET /api/avisos/
    GET /api/avisos/{id}/
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = AvisoReadSerializer

    def get_queryset(self):
        now = timezone.now()
        qs = Aviso.objects.filter(status=Aviso.Status.PUBLICADO)
        qs = qs.filter(publish_at__lte=now) | qs.filter(publish_at__isnull=True)
        qs = qs.filter(expires_at__gte=now) | qs.filter(expires_at__isnull=True)

        search = self.request.query_params.get("search") or ""
        if search:
            qs = qs.filter(titulo__icontains=search) | qs.filter(cuerpo__icontains=search)
        ordering = self.request.query_params.get("ordering") or "-publish_at"
        return qs.order_by(ordering)
    
    
    
class AccessEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Bitácora de lecturas de placas.
    - STAFF/ADMIN: ven todo.
    - RESIDENT: solo eventos de sus vehículos o visitas.
    Filtros:
      ?from=YYYY-MM-DD&to=YYYY-MM-DD
      &camera_id=gate-1
      &decision=ALLOW_RESIDENT      (o decisions=ALLOW_RESIDENT,ALLOW_VISIT)
      &direction=ENTRADA|SALIDA
      &opened=true|false
      &plate=ABC
      &min_score=0.75
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = AccessEventSerializer

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["plate_norm", "plate_raw", "reason", "camera_id", "direction"]
    ordering_fields = ["created_at", "score", "camera_id", "decision", "direction", "opened"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = (
            AccessEvent.objects
            .select_related("vehicle", "visit", "triggered_by")
            .all()
            .order_by("-created_at")
        )

        u = self.request.user
        # STAFF / ADMIN ven todo
        if getattr(u, "is_superuser", False) or user_role_code(u) in {"ADMIN", "STAFF"}:
            return self._apply_query_params(qs)

        # RESIDENT: limitar a sus vehículos o visitas
        mis_vehiculos_ids = Vehiculo.objects.filter(propietario=u).values_list("id", flat=True)
        mis_unidades_ids = Unidad.objects.filter(Q(propietario=u) | Q(residente=u)).values_list("id", flat=True)
        mis_visitas_ids = Visit.objects.filter(
            Q(host_resident=u) | Q(unit_id__in=mis_unidades_ids)
        ).values_list("id", flat=True)

        qs = qs.filter(Q(vehicle_id__in=mis_vehiculos_ids) | Q(visit_id__in=mis_visitas_ids))
        return self._apply_query_params(qs)

    def _apply_query_params(self, qs):
        req = self.request
        f = req.query_params.get("from")
        t = req.query_params.get("to")
        cam = req.query_params.get("camera_id")
        dec = req.query_params.get("decision")                 # uno solo
        decs = req.query_params.get("decisions")               # varios separados por coma
        opened = req.query_params.get("opened")
        plate = req.query_params.get("plate")
        direction = req.query_params.get("direction")          # ENTRADA|SALIDA
        min_score = req.query_params.get("min_score")

        if f:
            d = parse_date(f)
            if d: qs = qs.filter(created_at__date__gte=d)
        if t:
            d = parse_date(t)
            if d: qs = qs.filter(created_at__date__lte=d)
        if cam:
            qs = qs.filter(camera_id__iexact=cam)
        if dec:
            qs = qs.filter(decision__iexact=dec)
        if decs:
            opts = [x.strip() for x in decs.split(",") if x.strip()]
            if opts:
                qs = qs.filter(decision__in=opts)
        if opened in {"true", "false", "1", "0"}:
            qs = qs.filter(opened=(opened in {"true", "1"}))
        if plate:
            qs = qs.filter(plate_norm__icontains=plate.replace(" ", "").upper())
        if direction in {"ENTRADA", "SALIDA"}:
            qs = qs.filter(direction=direction)
        if min_score:
            try:
                qs = qs.filter(score__gte=float(min_score))
            except ValueError:
                pass
        return qs

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        """
        Exporta CSV con los mismos filtros que la lista.
        """
        import csv
        from django.http import HttpResponse

        qs = self.get_queryset()
        resp = HttpResponse(content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="access_events.csv"'
        w = csv.writer(resp)
        w.writerow([
            "id","created_at","camera_id","direction",
            "plate_raw","plate_norm","score",
            "decision","opened","reason",
            "vehicle_id","visit_id","triggered_by_id",
        ])
        for e in qs.iterator():
            w.writerow([
                e.id,
                e.created_at.isoformat(),
                e.camera_id,
                getattr(e, "direction", "") or "",
                e.plate_raw,
                e.plate_norm,
                e.score if e.score is not None else "",
                e.decision,
                e.opened,
                e.reason,
                e.vehicle_id,
                e.visit_id,
                e.triggered_by_id,
            ])
        return resp
    
    
class FaceAccessEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Bitácora de reconocimientos faciales.
    - ADMIN/STAFF: ven todo.
    - RESIDENT: solo sus propios eventos (matched_user = él/ella).
    Filtros: ?from=YYYY-MM-DD&to=YYYY-MM-DD&camera_id=&decision=&direction=&user=<id>
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = FaceAccessEventSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["camera_id", "reason"]
    ordering_fields = ["created_at", "score", "camera_id", "decision", "opened"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = FaceAccessEvent.objects.select_related("matched_user", "triggered_by").all()
        u = self.request.user
        if getattr(u, "is_superuser", False) or user_role_code(u) in {"ADMIN", "STAFF"}:
            return self._apply_filters(qs)
        # residente: solo sus eventos
        return self._apply_filters(qs.filter(matched_user=u))

    def _apply_filters(self, qs):
        req = self.request
        f = req.query_params.get("from")
        t = req.query_params.get("to")
        cam = req.query_params.get("camera_id")
        dec = req.query_params.get("decision")
        direction = req.query_params.get("direction")
        user_id = req.query_params.get("user")

        if f:
            d = parse_date(f)
            if d:
                qs = qs.filter(created_at__date__gte=d)
        if t:
            d = parse_date(t)
            if d:
                qs = qs.filter(created_at__date__lte=d)
        if cam:
            qs = qs.filter(camera_id__iexact=cam)
        if dec:
            qs = qs.filter(decision__iexact=dec)
        if direction:
            qs = qs.filter(direction__iexact=direction)
        if user_id:
            try:
                qs = qs.filter(matched_user_id=int(user_id))
            except:
                pass
        return qs

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        qs = self.get_queryset()
        import csv
        from django.http import HttpResponse
        resp = HttpResponse(content_type="text/csv")
        resp["Content-Disposition"] = 'attachment; filename="face_access_events.csv"'
        w = csv.writer(resp)
        w.writerow([
            "id","created_at","camera_id","direction",
            "decision","score","opened",
            "matched_user_id","triggered_by_id",
            "snapshot","reason"
        ])
        for e in qs.iterator():
            w.writerow([
                e.id, e.created_at.isoformat(), e.camera_id, e.direction,
                e.decision, e.score, e.opened,
                getattr(e.matched_user, "id", None),
                getattr(e.triggered_by, "id", None),
                e.snapshot.url if getattr(e, "snapshot", None) else "",
                e.reason.replace("\n"," ").strip() if e.reason else "",
            ])
        return resp