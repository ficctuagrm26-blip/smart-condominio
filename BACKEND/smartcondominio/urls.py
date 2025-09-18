
from django.urls import path
from .views_api import RegisterView, me

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='api-register'),
    path('me/', me, name='api-me'),
]
