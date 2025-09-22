
from django.urls import path
from .views_api import RegisterView, me, AdminUserViewSet, me_update, change_password, RolViewSet, PermissionViewSet, UnidadViewSet
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token


router = DefaultRouter()
router.register(r'admin/users', AdminUserViewSet, basename='admin-users')
router.register(r'roles',RolViewSet, basename='roles')
router.register(r'permissions', PermissionViewSet, basename='permissions')
router.register(r'unidades', UnidadViewSet, basename='unidades')


urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
     path('auth/login/', obtain_auth_token, name='token_login'), 
    path('auth/me/', me, name='me'),
    path('auth/me/update/', me_update,      name='me-update'),
    path('auth/change-password/', change_password, name='change-password'),
]


urlpatterns += router.urls