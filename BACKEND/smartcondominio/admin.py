from django.contrib import admin
from .models import Profile

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role")       # columnas en la lista
    search_fields = ("user__username",)   # búsqueda por nombre de usuario
    list_filter = ("role",)               # filtros por rol

