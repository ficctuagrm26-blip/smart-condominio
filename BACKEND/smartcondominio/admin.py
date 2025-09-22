from django.contrib import admin
from .models import Profile, Unidad

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role")       # columnas en la lista
    search_fields = ("user__username",)   # búsqueda por nombre de usuario
    list_filter = ("role",)               # filtros por rol

@admin.register(Unidad)
class UnidadAdmin(admin.ModelAdmin):
    list_display = (      # columnas que se mostrarán en la tabla del admin
        "id", "torre", "bloque", "numero",
        "tipo", "estado", "propietario", "residente", "is_active"
    )
    list_filter = (       # filtros en la barra lateral
        "torre", "tipo", "estado", "is_active"
    )
    search_fields = (     # campos por los que se podrá buscar en el admin
        "torre", "bloque", "numero"
    )
