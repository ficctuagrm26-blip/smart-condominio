from django.contrib.auth.models import User
from rest_framework import generics, permissions, viewsets,filters
from rest_framework.decorators import api_view, permission_classes,  authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from rest_framework import status

from .permissions import IsAdmin

from .models import Rol
from .serializers import RegisterSerializer, MeSerializer, AdminUserSerializer, MeUpdateSerializer, ChangePasswordSerializer, RolSimpleSerializer
from .permissions import IsAdmin
from django.db.models import Q
from django.db.models.deletion import ProtectedError, RestrictedError
from django.db import IntegrityError

# 👤 Registrar usuario (signup API)
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

#ADMIN DE USUARIOS 
class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("profile").all().order_by("id")
    serializer_class = AdminUserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        # Políticas de seguridad sugeridas (ajústalas si quieres):
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
            # útil mientras depuras; luego puedes quitar este catch-all
            return Response({"detail": "Error inesperado al eliminar.", "error": str(e)},
                            status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_204_NO_CONTENT)
    # búsquedas y orden (opcional pero útil en el panel)
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["username", "first_name", "last_name", "email", "profile__role"]
    ordering_fields = ["id", "username", "email", "first_name", "last_name", "is_active"]


# 🔒 Datos del usuario autenticado (perfil)
@api_view(["GET"])
@authentication_classes([TokenAuthentication]) 
@permission_classes([IsAuthenticated])
def me(request):
    return Response(MeSerializer(request.user).data)


@api_view(['PATCH'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def me_update(request):
    """
    Actualiza datos del usuario autenticado.
    Respeta campos permitidos por rol (ver ROLE_EDITABLE_FIELDS).
    """
    ser = MeUpdateSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    user = ser.save()
    return Response(MeSerializer(user).data, status=status.HTTP_200_OK)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def change_password(request):
    """
    Cambia la contraseña del usuario autenticado.
    Requiere current_password y new_password.
    """
    ser = ChangePasswordSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response({"detail": "Contraseña actualizada correctamente."}, status=status.HTTP_200_OK)

#ROLVIEWSET
class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all().order_by('code')
    serializer_class = RolSimpleSerializer  # fields: ["id","code","name","description"]
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]  # solo admin