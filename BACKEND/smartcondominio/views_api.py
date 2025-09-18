from django.contrib.auth.models import User
from rest_framework import generics, permissions, viewsets,filters
from rest_framework.decorators import api_view, permission_classes,  authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from rest_framework import status

from .permissions import IsAdmin


from .serializers import RegisterSerializer, MeSerializer, AdminUserSerializer
from .permissions import IsAdmin

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
        obj = self.get_object()
        if obj.id == request.user.id:
            return Response({"detail": "No puedes eliminarte a ti mismo."}, status=400)
        if obj.is_superuser:
            return Response({"detail": "No puedes eliminar un superusuario."}, status=400)
        return super().destroy(request, *args, **kwargs)
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
#PRUEBA

