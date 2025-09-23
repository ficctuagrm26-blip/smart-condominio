from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.db.models import Q
from django.db.models.deletion import ProtectedError, RestrictedError
from rest_framework import status, permissions, viewsets, filters
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, permission_classes, authentication_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.contrib.auth.models import Permission
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Rol, Profile, Unidad, Cuota, Pago
from .permissions import IsAdmin
from .serializers import (
    RegisterSerializer,
    MeSerializer,
    AdminUserSerializer,
    MeUpdateSerializer,
    ChangePasswordSerializer,
    RolSimpleSerializer,
    PermissionBriefSerializer, UnidadSerializer, CuotaSerializer, PagoCreateSerializer, PagoSerializer,GenerarCuotasSerializer   # 👈 lo importamos (definido en serializers.py)
)

User = get_user_model()

# 👤 Registrar usuario
from rest_framework import generics
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

# 👥 Admin de usuarios
class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("profile__role").all().order_by("id")
    serializer_class = AdminUserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    # búsquedas y orden
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["username", "first_name", "last_name", "email", "profile__role__code", "profile__role__name"]
    ordering_fields = ["id", "username", "email", "first_name", "last_name", "is_active"]

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
            return Response(
                {"detail": "No se puede eliminar: tiene registros relacionados (integridad referencial)."},
                status=status.HTTP_409_CONFLICT
            )
        except IntegrityError as e:
            return Response(
                {"detail": "No se puede eliminar por integridad referencial.", "error": str(e)},
                status=status.HTTP_409_CONFLICT
            )
        except Exception as e:
            return Response({"detail": "Error inesperado al eliminar.", "error": str(e)},
                            status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_204_NO_CONTENT)

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
    # Solo admin escribe; cualquiera autenticado puede leer (cámbialo si quieres solo admin total)
    permission_classes = [IsAuthenticated, IsAdmin]

    # backends correctos
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["torre", "bloque", "estado", "tipo", "is_active", "propietario", "residente"]
    search_fields = ["torre", "bloque", "numero"]
    ordering_fields = ["torre", "bloque", "numero", "updated_at"]
    ordering = ["torre", "bloque", "numero"]

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
    filterset_fields = ["unidad", "periodo", "concepto", "estado", "is_active", "unidad__torre"]
    search_fields = ["periodo", "concepto", "unidad__torre", "unidad__bloque", "unidad__numero"]
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