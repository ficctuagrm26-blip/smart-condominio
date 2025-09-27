from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from django.db import IntegrityError
from django.db.models import Q, Sum, F, DecimalField, ExpressionWrapper
from django.db.models.deletion import ProtectedError, RestrictedError
from rest_framework import status, permissions, viewsets, filters, serializers
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, permission_classes, authentication_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
import csv
from django.contrib.auth.models import Permission
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from datetime import date
from .models import Rol, Profile, Unidad, Cuota, Pago, Infraccion, Visitor, Visit
from .permissions import IsAdmin
from .permissions import user_role_code, has_role_permission, IsStaffGuardOrAdmin
from .serializers import (
    RegisterSerializer,
    MeSerializer,
    AdminUserSerializer,
    MeUpdateSerializer,
    ChangePasswordSerializer,
    RolSimpleSerializer,
    PermissionBriefSerializer, UnidadSerializer, CuotaSerializer, PagoCreateSerializer, PagoSerializer,GenerarCuotasSerializer, InfraccionSerializer,PagoEstadoCuentaSerializer,UnidadBriefECSerializer, VisitorSerializer, VisitSerializer   # 👈 lo importamos (definido en serializers.py)
)
from .models import Aviso, Unidad
from .serializers import AvisoSerializer
from .permissions import IsAdmin, user_role_code, VisitAccess, IsStaff
from django.utils import timezone
from django.db import models
from .models import Tarea, TareaComentario  # + ya tienes Unidad, etc.
from .serializers import (
    # ... lo que ya tienes ...
    TareaSerializer, TareaWriteSerializer, TareaComentarioSerializer,
)
from rest_framework import status
from .permissions import IsAdmin, IsStaff

User = get_user_model()

# 👤 Registrar usuario
# 👤 Registrar usuario
from rest_framework import generics
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        data = AdminUserSerializer(user).data
        return Response(
            {
                "status": 1,
                "error": 0,
                "message": "REGISTRO EXITOSO",
                "values": {"user": data},
            },
            status=status.HTTP_201_CREATED,
        )


# 👥 Admin de usuarios
# --- REEMPLAZO COMPLETO DE AdminUserViewSet ---
class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("profile__role").all().order_by("id")
    serializer_class = AdminUserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    # búsquedas / orden / filtros
    from django_filters.rest_framework import DjangoFilterBackend
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
            return Response({"detail": "No puedes eliminar tu propia cuenta."},
                            status=status.HTTP_400_BAD_REQUEST)

        if getattr(instance, "is_superuser", False) and not getattr(request.user, "is_superuser", False):
            return Response({"detail": "Solo un superusuario puede eliminar a otro superusuario."},
                            status=status.HTTP_403_FORBIDDEN)

        if getattr(instance, "is_superuser", False) and not User.objects.filter(
            is_superuser=True, is_active=True
        ).exclude(pk=instance.pk).exists():
            return Response({"detail": "No se puede eliminar el último superusuario activo."},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            self.perform_destroy(instance)
        except (ProtectedError, RestrictedError):
            return Response({"detail": "No se puede eliminar: tiene registros relacionados (integridad referencial)."},
                            status=status.HTTP_409_CONFLICT)
        except IntegrityError as e:
            return Response({"detail": "No se puede eliminar por integridad referencial.", "error": str(e)},
                            status=status.HTTP_409_CONFLICT)
        except Exception as e:
            return Response({"detail": "Error inesperado al eliminar.", "error": str(e)},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # listas rápidas
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


# 🔒 Perfil del usuario autenticado
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
    return Response(MeSerializer(user).data, status=status.HTTP_200_OK)

@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def change_password(request):
    ser = ChangePasswordSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response({"detail": "Contraseña actualizada correctamente."}, status=status.HTTP_200_OK)

# 🧩 Roles
class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all().order_by("code")
    serializer_class = RolSimpleSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def destroy(self, request, *args, **kwargs):
        rol = self.get_object()
        if getattr(rol, "is_system", False):
            return Response({"detail":"No se puede borrar un rol de sistema."}, status=status.HTTP_400_BAD_REQUEST)
        if Profile.objects.filter(role=rol).exists():
            return Response({"detail":"No se puede borrar: hay usuarios usando este rol."}, status=status.HTTP_400_BAD_REQUEST)
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
        perms = rol.permissions.select_related("content_type").all().order_by(
            "content_type__app_label", "codename"
        )
        data = PermissionBriefSerializer(perms, many=True).data
        return Response(data)

# 📚 Catálogo de permisos (solo lectura)
class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.select_related("content_type").all() \
        .order_by("content_type__app_label","codename")
    serializer_class = PermissionBriefSerializer
    http_method_names = ["get"]
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        q = self.request.query_params.get("q")
        qs = super().get_queryset()
        if q:
            qs = qs.filter(
                Q(codename__icontains=q) |
                Q(name__icontains=q) |
                Q(content_type__app_label__icontains=q) |
                Q(content_type__model__icontains=q)
            )
        return qs
#-----UNIDAD GESTION
class UnidadViewSet(viewsets.ModelViewSet):
    queryset = Unidad.objects.select_related("propietario", "residente").all()
    serializer_class = UnidadSerializer

    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    # Lookups útiles (puedes ajustar)
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

    # --- Compatibilidad temporal con ?torre=&bloque= ---
    def get_queryset(self):
        qs = super().get_queryset()
        req = self.request.query_params

        # Permite seguir usando ?torre=&bloque= desde el FE antiguo
        torre = req.get("torre")
        bloque = req.get("bloque")
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
        return Response(self.get_serializer(obj).data, status=status.HTTP_200_OK)

    @action(methods=["post"], detail=True, url_path="asignar")
    def asignar(self, request, pk=None):
        """
        Body: { "propietario": user_id | null, "residente": user_id | null }
        """
        obj = self.get_object()
        ser = self.get_serializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(self.get_serializer(obj).data, status=status.HTTP_200_OK)

#PAGOS Y CUOTAS
class CuotaViewSet(viewsets.ModelViewSet):
    queryset = Cuota.objects.select_related("unidad").all()
    serializer_class = CuotaSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]  # + tu IsAdmin si aplica

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
    "unidad", "periodo", "concepto", "estado", "is_active",
    "unidad__manzana", "unidad__lote", "unidad__numero",
    ]
    search_fields = ["periodo", "concepto", "unidad__manzana", "unidad__lote", "unidad__numero"]
    ordering_fields = ["vencimiento", "updated_at", "total_a_pagar", "pagado"]
    ordering = ["-periodo", "unidad_id"]

    # ---------- generar ----------
    def get_serializer_class(self):
        if getattr(self, "action", None) == "generar":
            return GenerarCuotasSerializer
        return super().get_serializer_class()

    @action(detail=False, methods=["post"], url_path="generar")
    def generar(self, request):
        s = self.get_serializer(data=request.data)  # GenerarCuotasSerializer
        s.is_valid(raise_exception=True)
        data = s.validated_data

        periodo        = data["periodo"]
        concepto       = data["concepto"]
        monto_base     = data["monto_base"]
        usa_coeficiente= data["usa_coeficiente"]
        vencimiento    = data["vencimiento"]

        afectadas = []
        for u in Unidad.objects.filter(is_active=True):
            c, _ = Cuota.objects.get_or_create(
                unidad=u, periodo=periodo, concepto=concepto, is_active=True,
                defaults={
                    "monto_base": monto_base,
                    "usa_coeficiente": usa_coeficiente,
                    "coeficiente_snapshot": u.coeficiente or 0,
                    "vencimiento": vencimiento,
                }
            )
            # actualizar si ya existía
            c.monto_base = monto_base
            c.usa_coeficiente = usa_coeficiente
            if usa_coeficiente:
                c.coeficiente_snapshot = u.coeficiente or 0
            c.vencimiento = vencimiento
            c.recalc_importes()
            c.recalc_estado()
            c.save()
            afectadas.append(c.id)

        return Response({"ok": True, "cuotas_afectadas": afectadas, "total": len(afectadas)}, status=status.HTTP_201_CREATED)

    # ---------- pagar desde la cuota ----------
    @action(detail=True, methods=["post"], url_path="pagos")
    def registrar_pago(self, request, pk=None):
        cuota = self.get_object()
        data = {**request.data, "cuota": cuota.id}  # forzar la cuota correcta
        ser = PagoCreateSerializer(data=data, context={"request": request})
        ser.is_valid(raise_exception=True)
        pago = ser.save()  # aplica automáticamente
        return Response(PagoSerializer(pago).data, status=status.HTTP_201_CREATED)

    # ---------- anular cuota ----------
    @action(detail=True, methods=["post"], url_path="anular")
    def anular_cuota(self, request, pk=None):
        cuota = self.get_object()
        if cuota.pagado > 0:
            return Response({"detail": "No se puede anular una cuota con pagos. Anule los pagos primero."}, status=400)
        cuota.is_active = False
        cuota.recalc_estado()
        cuota.save(update_fields=["is_active", "estado", "updated_at"])
        return Response(CuotaSerializer(cuota).data, status=200)

class PagoViewSet(viewsets.ModelViewSet):
    queryset = Pago.objects.select_related("cuota", "creado_por").all()
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]  # agrega tu IsAdmin si aplica
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["cuota", "valido", "medio"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        return PagoCreateSerializer if self.action == "create" else PagoSerializer

    def create(self, request, *args, **kwargs):
        ser_in = self.get_serializer(data=request.data, context={"request": request})
        ser_in.is_valid(raise_exception=True)
        pago = ser_in.save()
        ser_out = PagoSerializer(pago, context={"request": request})
        return Response(ser_out.data, status=status.HTTP_201_CREATED)
    
class InfraccionViewSet(viewsets.ModelViewSet):
    queryset = Infraccion.objects.select_related("unidad", "residente", "creado_por").all()
    serializer_class = InfraccionSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
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

# ====== TAREAS ======
class TareaViewSet(viewsets.ModelViewSet):
    """
    CU15 / CU24:
    - Admin/Staff ven todas y pueden crear/editar.
    - Residentes solo ven: asignadas a ellos, creadas por ellos,
      de su rol (si hay asignado_a_rol) o de sus unidades.
    - Un asignado puede actualizar estado/descripcion y comentar.
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["estado", "prioridad", "asignado_a", "asignado_a_rol", "unidad", "is_active"]
    search_fields = ["titulo", "descripcion", "unidad__manzana", "unidad__lote", "unidad__numero", "creado_por__username", "asignado_a__username"]
    ordering_fields = ["updated_at", "created_at", "fecha_limite", "prioridad"]
    ordering = ["-updated_at", "-created_at"]

    def get_serializer_class(self):
        # En create/update usa write; en list/retrieve devuelve full
        if self.action in {"create", "update", "partial_update"}:
            return TareaWriteSerializer
        return TareaSerializer

    def get_queryset(self):
        u = self.request.user
        qs = Tarea.objects.select_related("asignado_a", "asignado_a_rol", "creado_por", "unidad")
        # Admin/staff ven todo
        from .permissions import user_role_code
        if getattr(u, "is_superuser", False) or user_role_code(u) in {"ADMIN", "STAFF"}:
            return qs
        # Residentes: sólo las relacionadas
        mis_unidades = Unidad.objects.filter(Q(propietario=u) | Q(residente=u)).values_list("id", flat=True)
        rol_id = getattr(getattr(getattr(u, "profile", None), "role", None), "id", None)
        return qs.filter(
            Q(creado_por=u) |
            Q(asignado_a=u) |
            Q(unidad_id__in=mis_unidades) |
            Q(asignado_a_rol_id=rol_id)
        ).distinct()

    def perform_create(self, serializer):
        u = self.request.user
        is_admin = getattr(u, "is_superuser", False) or user_role_code(u) == "ADMIN"
        can_manage = has_role_permission(u, "manage_tasks")
        if not (is_admin or can_manage):
            return Response({"detail": "No autorizado para crear tareas."}, status=403)

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

        if not is_staff_manage and instancia.asignado_a_id != u.id:
            return Response({"detail": "Solo el asignado puede actualizar la tarea."}, status=403)

        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instancia, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        if not is_staff_manage:
            allowed = {"descripcion", "estado", "checklist"}
            dirty = set(serializer.validated_data.keys()) - allowed
            if dirty:
                return Response({"detail": f"Como asignado, solo puedes modificar: {', '.join(sorted(allowed))}."}, status=403)

        self.perform_update(serializer)
        return Response(TareaSerializer(instancia).data)
    
    
    # ---- Acciones de CU24 ----
    @action(detail=True, methods=["post"])
    def asignar(self, request, pk=None):
        """Asignar a usuario o a rol (exclusivo). Solo admin/staff."""
        from .permissions import user_role_code
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
        """Un usuario puede 'tomar' una tarea de rol si su rol coincide."""
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
        """Asignado o staff puede cambiar estado."""
        obj = self.get_object()
        nuevo = request.data.get("estado")
        if nuevo not in dict(Tarea.ESTADO_CHOICES):
            return Response({"detail": "Estado inválido."}, status=400)
        u = request.user
        from .permissions import user_role_code
        is_staff = getattr(u, "is_superuser", False) or user_role_code(u) in {"ADMIN", "STAFF"}
        if not is_staff and obj.asignado_a_id != u.id:
            return Response({"detail": "No autorizado."}, status=403)
        obj.estado = nuevo
        obj.save(update_fields=["estado", "updated_at"])
        return Response(TareaSerializer(obj).data)

    @action(detail=True, methods=["post"])
    def comentar(self, request, pk=None):
        """Crea comentario en la tarea (cualquiera que pueda verla)."""
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

class EstadoCuentaView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get_user_unidades(self, user):
        # Unidades donde es propietario o residente
        return Unidad.objects.filter(Q(propietario=user) | Q(residente=user)).order_by("torre", "bloque", "numero")

    def get(self, request):
        user = request.user
        unidades = self.get_user_unidades(user)
        if not unidades.exists():
            return Response({"detail": "No tiene unidades asociadas."}, status=404)

        # unidad elegida (si no, la primera)
        unidad_id = request.query_params.get("unidad")
        if unidad_id:
            unidad = unidades.filter(id=unidad_id).first()
            if not unidad:
                return Response({"detail": "Unidad inválida para este usuario."}, status=403)
        else:
            unidad = unidades.first()

        # Cuotas de esa unidad (puedes ajustar límites si quieres)
        cuotas_qs = Cuota.objects.select_related("unidad").filter(unidad=unidad).order_by("-vencimiento", "-updated_at")

        # Pagos de esa unidad
        pagos_qs = Pago.objects.select_related("cuota", "creado_por", "cuota__unidad").filter(cuota__unidad=unidad).order_by("-created_at")

        # Resumen
        saldo_expr = ExpressionWrapper(F("total_a_pagar") - F("pagado"), output_field=DecimalField(max_digits=12, decimal_places=2))
        agg = cuotas_qs.aggregate(
            saldo_pendiente=Sum(saldo_expr),
            total_pagado=Sum("pagado"),
            total_cobrado=Sum("total_a_pagar"),
        )
        cuotas_pendientes = cuotas_qs.filter(estado__in=["PENDIENTE", "VENCIDO", "PARCIAL"]).count()
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
        return Unidad.objects.filter(Q(propietario=user) | Q(residente=user)).order_by("torre", "bloque", "numero")

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

        # Generar CSV
        resp = HttpResponse(content_type="text/csv")
        filename = f"estado_cuenta_unidad_{unidad.id}_{date.today().isoformat()}.csv"
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        writer = csv.writer(resp)

        writer.writerow([f"Estado de cuenta - Unidad {unidad.torre}-{unidad.bloque}-{unidad.numero} (ID {unidad.id})"])
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

class AvisoViewSet(viewsets.ModelViewSet):
    queryset = Aviso.objects.all()
    serializer_class = AvisoSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["audiencia", "status", "torre", "is_active"]
    search_fields = ["titulo", "cuerpo", "torre"]
    ordering_fields = ["publish_at", "created_at", "updated_at"]
    ordering = ["-publish_at", "-created_at"]

    def _is_admin(self, user):
        return user.is_superuser or user_role_code(user) == "ADMIN"

    def get_queryset(self):
        qs = super().get_queryset().filter(is_active=True)
        u = self.request.user
        now = timezone.now()

        if self._is_admin(u):
            return qs

        qs = qs.filter(status="PUBLICADO").filter(models.Q(publish_at__lte=now) | models.Q(publish_at__isnull=True))
        qs = qs.exclude(expires_at__lt=now)

        r_id = getattr(getattr(getattr(u, "profile", None), "role", None), "id", None)
        unidades_user = Unidad.objects.filter(models.Q(propietario=u) | models.Q(residente=u))
        cond_all = models.Q(audiencia="ALL")
        cond_torre = models.Q(audiencia="TORRE", torre__in=list(unidades_user.values_list("torre", flat=True)))
        cond_unidad = models.Q(audiencia="UNIDAD", unidades__in=list(unidades_user.values_list("id", flat=True)))
        cond_rol = models.Q(audiencia="ROL", roles__in=[r_id] if r_id else [])
        return qs.filter(cond_all | cond_torre | cond_unidad | cond_rol).distinct()

    def create(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"detail": "Solo administradores pueden crear avisos."}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"detail": "Solo administradores pueden editar avisos."}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"detail": "Solo administradores pueden eliminar avisos."}, status=403)
        aviso = self.get_object()
        aviso.is_active = False
        aviso.save(update_fields=["is_active"])
        return Response(status=204)

    @action(detail=True, methods=["post"], url_path="publicar")
    def publicar(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response({"detail": "Solo administradores."}, status=403)
        aviso = self.get_object()
        aviso.publicar_ahora()
        aviso.save(update_fields=["status", "publish_at", "updated_at"])
        return Response(self.get_serializer(aviso).data)

    @action(detail=True, methods=["post"], url_path="archivar")
    def archivar(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response({"detail": "Solo administradores."}, status=403)
        aviso = self.get_object()
        aviso.status = "ARCHIVADO"
        aviso.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(aviso).data)
    
# ========= CU16: VIEWSET DE ÁREAS COMUNES =========
from datetime import datetime, timedelta, time
from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import AreaComun, AreaDisponibilidad, ReservaArea
from .serializers import AreaComunSerializer, DisponibilidadResponseSerializer
# ya tienes:
# from rest_framework.authentication import TokenAuthentication
# from rest_framework.permissions import IsAuthenticated
# from .permissions import IsAdmin

class AreaComunViewSet(viewsets.ModelViewSet):
    """
    CRUD de áreas comunes (solo admins deberían crearlas/editar).
    Acción GET disponibilidad: devuelve slots libres para una fecha.
    """
    queryset = AreaComun.objects.filter(activa=True)
    serializer_class = AreaComunSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]   # lectura; escritura restringida abajo

    def get_permissions(self):
        # list/retrieve/disponibilidad → autenticado
        if self.action in {"list", "retrieve", "disponibilidad"}:
            return [IsAuthenticated()]
        # create/update/destroy → admin
        return [IsAuthenticated(), IsAdmin()]

    @action(detail=True, methods=["get"], url_path="disponibilidad")
    def disponibilidad(self, request, pk=None):
        """
        GET /api/areas-comunes/{id}/disponibilidad/?date=YYYY-MM-DD&slot=60
        Opcional: &from=HH:MM&to=HH:MM (sobrescribe ventanas configuradas)
        """
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
        weekday = target_date.weekday()  # 0..6

        # Ventanas: override o reglas de la BD
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
                return Response({
                    "area_id": area.id,
                    "date": target_date,
                    "slot_minutes": slot_minutes,
                    "windows": [],
                    "slots": []
                })
            windows = [(r.hora_inicio, r.hora_fin) for r in reglas]

        # Reservas activas que solapan ese día
        day_start = timezone.make_aware(datetime.combine(target_date, time(0, 0, 0)), tz)
        day_end   = timezone.make_aware(datetime.combine(target_date, time(23, 59, 59)), tz)
        activas = ["PENDIENTE", "CONFIRMADA", "PAGADA"]
        reservas = list(
            ReservaArea.objects.filter(area=area, estado__in=activas)
            .filter(Q(fecha_inicio__lte=day_end) & Q(fecha_fin__gte=day_start))
            .order_by("fecha_inicio")
        )

        # Unir reservas solapadas
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

        # Calcular intervalos libres por ventana
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

        # Discretizar a slots de N minutos
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
            "slots": slots
        }
        resp = DisponibilidadResponseSerializer(data)
        return Response(resp.data)
class StaffViewSet(viewsets.ModelViewSet):
    """
    CRUD de PERSONAL (sub-roles con Rol.base='STAFF').
    """
    serializer_class = AdminUserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = User.objects.select_related("profile", "profile__role").all().order_by("id")

    # Habilita búsqueda (?search=) y orden (?ordering=)
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["username", "first_name", "last_name", "email", "profile__role__code", "profile__role__name"]
    ordering_fields = ["id", "username", "first_name", "last_name", "email"]

    def get_queryset(self):
        # Solo personal (base STAFF), excluye superusuarios
        qs = super().get_queryset().filter(
            profile__role__base="STAFF"
        ).exclude(is_superuser=True)

        # Alias para ?q= como búsqueda rápida (además de ?search= propio de DRF)
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(username__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(email__icontains=q)
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
        return Response(self.get_serializer(user).data, status=status.HTTP_201_CREATED)

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
    
# VISITANTES
class VisitorViewSet(viewsets.ModelViewSet):
    queryset = Visitor.objects.all().order_by("full_name")
    serializer_class = VisitorSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["full_name", "doc_number"]
    ordering_fields = ["full_name", "doc_number"]

    # listar/ver: cualquier autenticado; crear/editar/borrar: STAFF/ADMIN
    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsStaff()]

# --- VISITS ---
class VisitViewSet(viewsets.ModelViewSet):
    queryset = Visit.objects.select_related("visitor", "unit", "host_resident").all()
    serializer_class = VisitSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "unit", "host_resident"]
    search_fields = ["visitor__full_name", "visitor__doc_number", "vehicle_plate", "purpose"]
    ordering_fields = ["created_at", "entry_at", "exit_at"]

    def get_permissions(self):
        # crear/editar/cerrar estados → STAFF/ADMIN
        staff_actions = {"create", "update", "partial_update", "destroy", "enter", "exit", "cancel", "deny"}
        if self.action in staff_actions:
            return [IsAuthenticated(), IsStaff()]
        # listar/ver → autenticado
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        u = self.request.user
        # Admin / base STAFF ven todo
        code = user_role_code(u)
        base = getattr(getattr(getattr(u, "profile", None), "role", None), "base", None)
        if getattr(u, "is_superuser", False) or code == "ADMIN" or base == "STAFF":
            return qs
        # Residente: solo sus visitas
        mis_unidades = Unidad.objects.filter(Q(propietario=u) | Q(residente=u)).values_list("id", flat=True)
        return qs.filter(Q(host_resident=u) | Q(unit_id__in=mis_unidades)).distinct()

    def perform_create(self, serializer):
        # No pases created_by aquí: el serializer ya lo asigna desde context
        serializer.save()

    def perform_update(self, serializer):
        # Igual con updated_by: el serializer lo asigna
        serializer.save()

    @action(detail=True, methods=["post"])
    def enter(self, request, pk=None):
        visit = self.get_object()
        if visit.status not in ["REGISTRADO", "DENEGADO"]:
            return Response({"detail": "La visita no está en estado apto para ingreso."}, status=400)
        visit.mark_entry(request.user)
        visit.save()
        return Response(VisitSerializer(visit, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def exit(self, request, pk=None):
        visit = self.get_object()
        if visit.status != "INGRESADO":
            return Response({"detail": "La visita no está ingresada."}, status=400)
        visit.mark_exit(request.user)
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


# --- NUEVO: API Vehículos / Solicitudes ---
from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.authentication import TokenAuthentication  # usa la tuya si es distinta

from .models import Vehiculo, SolicitudVehiculo
from .serializers import (
    VehiculoSerializer,
    SolicitudVehiculoCreateSerializer,
    SolicitudVehiculoListSerializer,
    SolicitudVehiculoReviewSerializer,
)
from .permissions import IsAdminOrStaff, IsOwnerOrAdmin

class VehiculoViewSet(viewsets.ModelViewSet):
    """
    CU26 (parte): CRUD de vehículos autorizados.
    - ADMIN/STAFF: todos.
    - Residente/Personal: solo los propios; no pueden cambiar owner/placa/unidad.
    """
    queryset = Vehiculo.objects.select_related("propietario", "unidad").all()
    serializer_class = VehiculoSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["placa", "propietario", "unidad", "activo", "tipo"]

    def get_queryset(self):
        qs = super().get_queryset()
        if not IsAdminOrStaff().has_permission(self.request, self):
            qs = qs.filter(propietario=self.request.user)
        return qs

    def perform_update(self, serializer):
        if not IsAdminOrStaff().has_permission(self.request, self):
            for k in ("propietario", "placa", "unidad", "autorizado_en", "autorizado_por", "activo"):
                serializer.validated_data.pop(k, None)
        serializer.save()


class SolicitudVehiculoViewSet(mixins.CreateModelMixin,
                               mixins.ListModelMixin,
                               mixins.RetrieveModelMixin,
                               viewsets.GenericViewSet):
    """
    CU25: crear solicitud (residente/personal).
    CU26: listar/revisar (admin/staff). Acción POST /revisar/ (aprobar/rechazar).
    """
    queryset = SolicitudVehiculo.objects.select_related(
        "solicitante", "unidad", "vehiculo", "revisado_por"
    ).all()
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["estado", "placa", "unidad", "solicitante"]

    def get_serializer_class(self):
        if self.action == "create":
            return SolicitudVehiculoCreateSerializer
        if self.action == "revisar":
            return SolicitudVehiculoReviewSerializer
        return SolicitudVehiculoListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if not IsAdminOrStaff().has_permission(self.request, self):
            qs = qs.filter(solicitante=self.request.user)
        return qs

    def perform_create(self, serializer):
        profile = getattr(self.request.user, "profile", None)
        unidad = getattr(profile, "unit", None) or getattr(profile, "unidad", None)
        serializer.save(
            solicitante=self.request.user,
            unidad=unidad,
            estado="PENDIENTE"
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAdminOrStaff])
    @transaction.atomic
    def revisar(self, request, pk=None):
        """
        ADMIN/STAFF aprueba o rechaza.
        body: { "accion": "aprobar" | "rechazar", "observaciones": "..." }
        """
        obj = self.get_object()
        if obj.estado != "PENDIENTE":
            return Response({"detail": "La solicitud ya fue revisada."}, status=400)

        ser = SolicitudVehiculoReviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        accion = ser.validated_data["accion"]
        obs = ser.validated_data.get("observaciones", "")

        if accion == "rechazar":
            obj.rechazar(rechazado_por=request.user, observ=obs)
            return Response(SolicitudVehiculoListSerializer(obj).data)

        # aprobar
        unidad_override = request.query_params.get("unidad")
        unidad = obj.unidad
        if unidad_override:
            from .models import Unidad  # evita circular
            try:
                unidad = Unidad.objects.get(pk=unidad_override)
            except Unidad.DoesNotExist:
                return Response({"detail": "Unidad no existe."}, status=400)

        try:
            obj.aprobar(aprobado_por=request.user, unidad=unidad, observ=obs)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        return Response(SolicitudVehiculoListSerializer(obj).data, status=200)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    @transaction.atomic
    def cancelar(self, request, pk=None):
         """
         Residente cancela su propia solicitud si está PENDIENTE.
         body: { "observaciones": "opcional" }
         """
         obj = self.get_object()
         if obj.solicitante_id != request.user.id:
             return Response({"detail": "Solo el solicitante puede cancelar su solicitud."},
                             status=status.HTTP_403_FORBIDDEN)
         if obj.estado != "PENDIENTE":
             return Response({"detail": "Solo se pueden cancelar solicitudes en estado PENDIENTE."},
                            status=status.HTTP_400_BAD_REQUEST)
         obs = request.data.get("observaciones", "") or ""
         obj.cancelar(cancelado_por=request.user, observ=obs)
         return Response(SolicitudVehiculoListSerializer(obj).data, status=status.HTTP_200_OK)