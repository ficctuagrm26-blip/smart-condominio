
from django.urls import path
from .views_api import RegisterView, me, AdminUserViewSet
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token

router = DefaultRouter()
router.register(r'admin/users', AdminUserViewSet, basename='admin-users')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
     path('auth/login/', obtain_auth_token, name='token_login'), 
    path('auth/me/', me, name='me'),
]


urlpatterns += router.urls